use super::prfitem::decode_base64_text;
use anyhow::{Result, bail};
use clash_verge_logging::{Type, logging};
use percent_encoding::percent_decode_str;
use serde_json::{Map, Value as Json, json};
use serde_yaml_ng::{Mapping, Value};
use std::{
    collections::{HashMap, HashSet},
    net::IpAddr,
};
use tauri::Url;

pub const HAPP_USER_AGENT: &str = "Happ/4.5.4";

const AUTO_GROUP: &str = "⚡ Auto";
const DEFAULT_GROUP: &str = "Proxy";
const RESERVED_NAMES: [&str; 6] = ["DIRECT", "REJECT", "REJECT-DROP", "PASS", "COMPATIBLE", "GLOBAL"];
const UNSUPPORTED_MATCHERS: [&str; 11] = [
    "protocol",
    "inboundTag",
    "attrs",
    "balancerTag",
    "source",
    "sourceIP",
    "sourcePort",
    "user",
    "localIP",
    "localPort",
    "process",
];
const XHTTP_KEYS: [(&str, &str); 19] = [
    ("path", "path"),
    ("host", "host"),
    ("mode", "mode"),
    ("headers", "headers"),
    ("noGRPCHeader", "no-grpc-header"),
    ("xPaddingBytes", "x-padding-bytes"),
    ("xPaddingObfsMode", "x-padding-obfs-mode"),
    ("xPaddingKey", "x-padding-key"),
    ("xPaddingHeader", "x-padding-header"),
    ("xPaddingPlacement", "x-padding-placement"),
    ("xPaddingMethod", "x-padding-method"),
    ("uplinkHTTPMethod", "uplink-http-method"),
    ("sessionPlacement", "session-placement"),
    ("sessionKey", "session-key"),
    ("seqPlacement", "seq-placement"),
    ("seqKey", "seq-key"),
    ("uplinkDataPlacement", "uplink-data-placement"),
    ("uplinkDataKey", "uplink-data-key"),
    ("uplinkChunkSize", "uplink-chunk-size"),
];
const XHTTP_POST_KEYS: [(&str, &str); 2] = [
    ("scMaxEachPostBytes", "sc-max-each-post-bytes"),
    ("scMinPostsIntervalMs", "sc-min-posts-interval-ms"),
];
const XMUX_KEYS: [(&str, &str); 6] = [
    ("maxConcurrency", "max-concurrency"),
    ("maxConnections", "max-connections"),
    ("cMaxReuseTimes", "c-max-reuse-times"),
    ("hMaxRequestTimes", "h-max-request-times"),
    ("hMaxReusableSecs", "h-max-reusable-secs"),
    ("hKeepAlivePeriod", "h-keep-alive-period"),
];

/// Returns `None` when the body is already a Mihomo profile.
pub fn convert_subscription(data: &str, title: Option<&str>) -> Result<Option<std::string::String>> {
    match parse_configs(data.trim()) {
        Some(configs) => build_profile(&configs, title).map(Some),
        None => Ok(None),
    }
}

fn parse_configs(data: &str) -> Option<Vec<Json>> {
    match serde_json::from_str::<Json>(data) {
        Ok(Json::Array(configs)) => return Some(configs),
        Ok(config) if config.get("outbounds").is_some() => return Some(vec![config]),
        _ => {}
    }
    if serde_yaml_ng::from_str::<Mapping>(data).is_ok() {
        return None;
    }
    let text = if data.contains("://") {
        data.to_owned()
    } else {
        decode_base64_text(&data.split_whitespace().collect::<std::string::String>())?
    };
    let lines: Vec<&str> = text
        .lines()
        .map(str::trim)
        .filter(|line| line.contains("://"))
        .collect();
    if lines.is_empty() {
        return None;
    }
    Some(
        lines
            .into_iter()
            .filter_map(|line| {
                let config = link_config(line);
                if config.is_none() {
                    logging!(warn, Type::Config, "skipped an unsupported share link");
                }
                config
            })
            .collect(),
    )
}

fn build_profile(configs: &[Json], title: Option<&str>) -> Result<std::string::String> {
    let group = group_name(title);
    let mut used: HashSet<std::string::String> = [group.clone(), AUTO_GROUP.to_owned()].into();
    let mut proxies = Vec::new();
    let mut names = Vec::new();
    for config in configs {
        let remark = text(config, "remarks").unwrap_or_default();
        let Some(proxy) = config_proxy(config) else {
            logging!(warn, Type::Config, "skipped an unsupported Xray config: {remark}");
            continue;
        };
        let name = unique_name(&mut used, remark, &proxy);
        let mut named = Mapping::new();
        put(&mut named, "name", name.as_str());
        named.extend(proxy);
        names.push(Value::from(name));
        proxies.push(Value::from(named));
    }
    if proxies.is_empty() {
        bail!("the subscription contains no proxies that can be converted");
    }

    let mut select = Mapping::new();
    put(&mut select, "name", group.as_str());
    put(&mut select, "type", "select");
    put(
        &mut select,
        "proxies",
        std::iter::once(Value::from(AUTO_GROUP))
            .chain(names.iter().cloned())
            .collect::<Vec<_>>(),
    );
    let mut auto = Mapping::new();
    put(&mut auto, "name", AUTO_GROUP);
    put(&mut auto, "type", "url-test");
    put(&mut auto, "url", "https://www.gstatic.com/generate_204");
    put(&mut auto, "interval", 300);
    put(&mut auto, "tolerance", 50);
    put(&mut auto, "proxies", names);

    let mut rules = configs
        .first()
        .map(|config| routing_rules(config, &group))
        .unwrap_or_default();
    rules.push(format!("MATCH,{group}"));

    let mut profile = Mapping::new();
    put(&mut profile, "proxies", proxies);
    put(&mut profile, "proxy-groups", vec![select, auto]);
    put(&mut profile, "rules", rules);
    Ok(serde_yaml_ng::to_string(&profile)?)
}

fn group_name(title: Option<&str>) -> std::string::String {
    title
        .map(str::trim)
        .filter(|title| {
            !title.is_empty() && !title.contains(',') && *title != AUTO_GROUP && !RESERVED_NAMES.contains(title)
        })
        .unwrap_or(DEFAULT_GROUP)
        .to_owned()
}

fn unique_name(used: &mut HashSet<std::string::String>, remark: &str, proxy: &Mapping) -> std::string::String {
    let base = if remark.is_empty() {
        let field = |key: &str| match proxy.get(key) {
            Some(Value::String(value)) => value.clone(),
            Some(Value::Number(value)) => value.to_string(),
            _ => std::string::String::new(),
        };
        format!("{}:{}", field("server"), field("port"))
    } else {
        remark.to_owned()
    };
    let mut name = base.clone();
    let mut index = 2;
    while !used.insert(name.clone()) {
        name = format!("{base} {index}");
        index += 1;
    }
    name
}

fn config_proxy(config: &Json) -> Option<Mapping> {
    let outbounds = config.get("outbounds")?.as_array()?;
    let outbound = outbounds
        .iter()
        .find(|outbound| text(outbound, "tag") == Some("proxy"))
        .or_else(|| {
            outbounds.iter().find(|outbound| {
                !matches!(
                    text(outbound, "protocol"),
                    Some("freedom" | "blackhole" | "dns" | "loopback") | None
                )
            })
        })?;
    convert_outbound(outbound)
}

fn convert_outbound(outbound: &Json) -> Option<Mapping> {
    let protocol = text(outbound, "protocol")?;
    let settings = outbound.get("settings").unwrap_or(&Json::Null);
    let stream = outbound.get("streamSettings").unwrap_or(&Json::Null);
    if matches!(protocol, "hysteria" | "hysteria2") {
        return hysteria(settings, stream);
    }
    let mut proxy = Mapping::new();
    match protocol {
        "vless" => vless(&mut proxy, settings)?,
        "vmess" => vmess(&mut proxy, settings)?,
        "trojan" => trojan(&mut proxy, settings)?,
        "shadowsocks" if !matches!(text(stream, "security"), Some("tls" | "reality")) => {
            shadowsocks(&mut proxy, settings)?
        }
        _ => return None,
    }
    put(&mut proxy, "udp", true);
    if protocol != "shadowsocks" {
        transport(&mut proxy, stream)?;
    }
    let (sni_key, tls_flag) = if protocol == "trojan" {
        ("sni", false)
    } else {
        ("servername", true)
    };
    security(&mut proxy, stream, sni_key, tls_flag);
    Some(proxy)
}

fn first_or_self<'a>(settings: &'a Json, key: &str) -> &'a Json {
    settings.get(key).and_then(|list| list.get(0)).unwrap_or(settings)
}

fn endpoint(proxy: &mut Mapping, kind: &str, entry: &Json) -> Option<()> {
    let server = text(entry, "address")?;
    let port = port(entry.get("port")?)?;
    put(proxy, "type", kind);
    put(proxy, "server", server);
    put(proxy, "port", port);
    Some(())
}

fn vless(proxy: &mut Mapping, settings: &Json) -> Option<()> {
    let entry = first_or_self(settings, "vnext");
    let user = first_or_self(entry, "users");
    endpoint(proxy, "vless", entry)?;
    put(proxy, "uuid", text(user, "id")?);
    put_text(proxy, "flow", text(user, "flow"));
    put_text(
        proxy,
        "encryption",
        text(user, "encryption").filter(|value| *value != "none"),
    );
    put(proxy, "packet-encoding", "xudp");
    Some(())
}

fn vmess(proxy: &mut Mapping, settings: &Json) -> Option<()> {
    let entry = first_or_self(settings, "vnext");
    let user = first_or_self(entry, "users");
    endpoint(proxy, "vmess", entry)?;
    put(proxy, "uuid", text(user, "id")?);
    put(proxy, "alterId", user.get("alterId").and_then(port_like).unwrap_or(0));
    put(proxy, "cipher", text(user, "security").unwrap_or("auto"));
    Some(())
}

fn trojan(proxy: &mut Mapping, settings: &Json) -> Option<()> {
    let entry = first_or_self(settings, "servers");
    endpoint(proxy, "trojan", entry)?;
    put(proxy, "password", text(entry, "password")?);
    Some(())
}

fn shadowsocks(proxy: &mut Mapping, settings: &Json) -> Option<()> {
    let entry = first_or_self(settings, "servers");
    endpoint(proxy, "ss", entry)?;
    put(proxy, "cipher", text(entry, "method")?);
    put(proxy, "password", text(entry, "password")?);
    Some(())
}

fn hysteria(settings: &Json, stream: &Json) -> Option<Mapping> {
    let entry = first_or_self(settings, "servers");
    let options = stream.get("hysteriaSettings").unwrap_or(&Json::Null);
    let mut proxy = Mapping::new();
    endpoint(&mut proxy, "hysteria2", entry)?;
    let password = text(entry, "password")
        .or_else(|| text(entry, "auth"))
        .or_else(|| text(options, "auth"))?;
    put(&mut proxy, "password", password);
    for key in ["up", "down"] {
        if let Some(speed) = entry.get(key).or_else(|| options.get(key)).and_then(scalar) {
            put(&mut proxy, key, speed);
        }
    }
    let salamander = stream
        .pointer("/finalmask/udp")
        .and_then(Json::as_array)
        .and_then(|masks| masks.iter().find(|mask| text(mask, "type") == Some("salamander")))
        .and_then(|mask| text(mask.get("settings")?, "password"));
    let obfs = entry.get("obfs").unwrap_or(&Json::Null);
    if let Some(password) = text(obfs, "password").or(salamander) {
        put(&mut proxy, "obfs", text(obfs, "type").unwrap_or("salamander"));
        put(&mut proxy, "obfs-password", password);
    }
    put(&mut proxy, "udp", true);
    security(&mut proxy, stream, "sni", false);
    Some(proxy)
}

fn transport(proxy: &mut Mapping, stream: &Json) -> Option<()> {
    let network = text(stream, "network").unwrap_or("tcp");
    let setting = |key: &str| stream.get(key).unwrap_or(&Json::Null);
    match network {
        "tcp" | "raw" => tcp(
            proxy,
            stream.get("tcpSettings").unwrap_or_else(|| setting("rawSettings")),
        ),
        "ws" => websocket(proxy, setting("wsSettings"), false),
        "httpupgrade" => websocket(proxy, setting("httpupgradeSettings"), true),
        "grpc" => {
            put(proxy, "network", "grpc");
            let mut opts = Mapping::new();
            put_text(
                &mut opts,
                "grpc-service-name",
                text(setting("grpcSettings"), "serviceName"),
            );
            put(proxy, "grpc-opts", opts);
        }
        "h2" | "http" => {
            let settings = setting("httpSettings");
            put(proxy, "network", "h2");
            let mut opts = Mapping::new();
            let hosts = list(settings.get("host"));
            if !hosts.is_empty() {
                put(&mut opts, "host", hosts);
            }
            put_text(&mut opts, "path", text(settings, "path"));
            put(proxy, "h2-opts", opts);
        }
        "xhttp" | "splithttp" => {
            let settings = stream
                .get("xhttpSettings")
                .unwrap_or_else(|| setting("splithttpSettings"));
            put(proxy, "network", "xhttp");
            put(proxy, "xhttp-opts", xhttp(settings));
        }
        _ => return None,
    }
    Some(())
}

fn tcp(proxy: &mut Mapping, settings: &Json) {
    let header = settings.get("header").unwrap_or(&Json::Null);
    if text(header, "type") != Some("http") {
        put(proxy, "network", "tcp");
        return;
    }
    let request = header.get("request").unwrap_or(&Json::Null);
    let mut opts = Mapping::new();
    put_text(&mut opts, "method", text(request, "method"));
    let paths = list(request.get("path"));
    if !paths.is_empty() {
        put(&mut opts, "path", paths);
    }
    let headers = headers(request.get("headers"), true);
    if !headers.is_empty() {
        put(&mut opts, "headers", headers);
    }
    put(proxy, "network", "http");
    put(proxy, "http-opts", opts);
}

fn websocket(proxy: &mut Mapping, settings: &Json, upgrade: bool) {
    let mut opts = Mapping::new();
    put_text(&mut opts, "path", text(settings, "path"));
    let mut headers = headers(settings.get("headers"), false);
    if let Some(host) = text(settings, "host") {
        put(&mut headers, "Host", host);
    }
    if !headers.is_empty() {
        put(&mut opts, "headers", headers);
    }
    if upgrade {
        put(&mut opts, "v2ray-http-upgrade", true);
    }
    put(proxy, "network", "ws");
    put(proxy, "ws-opts", opts);
}

fn xhttp(settings: &Json) -> Mapping {
    let mut merged = settings.as_object().cloned().unwrap_or_default();
    if let Some(extra) = settings.get("extra").and_then(Json::as_object) {
        merged.extend(extra.clone());
    }
    let merged = Json::Object(merged);
    let mut opts = Mapping::new();
    for (from, to) in XHTTP_KEYS.iter().chain(XHTTP_POST_KEYS.iter()) {
        let value = match *from {
            "headers" => Some(headers(merged.get(from), false))
                .filter(|headers| !headers.is_empty())
                .map(Value::from),
            _ => merged.get(from).and_then(range),
        };
        if let Some(value) = value {
            put(&mut opts, to, value);
        }
    }
    if let Some(xmux) = merged.get("xmux") {
        let reuse: Mapping = XMUX_KEYS
            .iter()
            .filter_map(|(from, to)| Some((Value::from(*to), range(xmux.get(from)?)?)))
            .collect();
        if !reuse.is_empty() {
            put(&mut opts, "reuse-settings", reuse);
        }
    }
    if let Some(download) = merged.get("downloadSettings").and_then(download_settings) {
        put(&mut opts, "download-settings", download);
    }
    opts
}

fn download_settings(download: &Json) -> Option<Mapping> {
    let mut opts = xhttp(
        download
            .get("xhttpSettings")
            .or_else(|| download.get("splithttpSettings"))
            .unwrap_or(&Json::Null),
    );
    opts.retain(|key, _| matches!(key.as_str(), Some("path" | "host" | "headers" | "reuse-settings")));
    put_text(&mut opts, "server", text(download, "address"));
    if let Some(port) = download.get("port").and_then(port) {
        put(&mut opts, "port", port);
    }
    security(&mut opts, download, "servername", true);
    (!opts.is_empty()).then_some(opts)
}

fn security(proxy: &mut Mapping, stream: &Json, sni_key: &str, tls_flag: bool) {
    let reality = match text(stream, "security") {
        Some("tls") => false,
        Some("reality") => true,
        _ => return,
    };
    let settings = stream
        .get(if reality { "realitySettings" } else { "tlsSettings" })
        .unwrap_or(&Json::Null);
    if tls_flag {
        put(proxy, "tls", true);
    }
    put_text(proxy, sni_key, text(settings, "serverName"));
    if reality {
        let mut opts = Mapping::new();
        put_text(
            &mut opts,
            "public-key",
            text(settings, "publicKey").or_else(|| text(settings, "password")),
        );
        put_text(&mut opts, "short-id", text(settings, "shortId"));
        put(proxy, "reality-opts", opts);
        put(
            proxy,
            "client-fingerprint",
            text(settings, "fingerprint").unwrap_or("chrome"),
        );
        return;
    }
    let alpn = list(settings.get("alpn"));
    if !alpn.is_empty() {
        put(proxy, "alpn", alpn);
    }
    put_text(proxy, "client-fingerprint", text(settings, "fingerprint"));
    if settings.get("allowInsecure").and_then(Json::as_bool) == Some(true) {
        put(proxy, "skip-cert-verify", true);
    }
}

fn routing_rules(config: &Json, group: &str) -> Vec<std::string::String> {
    let outbounds = config
        .get("outbounds")
        .and_then(Json::as_array)
        .map(Vec::as_slice)
        .unwrap_or_default();
    config
        .pointer("/routing/rules")
        .and_then(Json::as_array)
        .map(|rules| {
            rules
                .iter()
                .flat_map(|rule| convert_rule(rule, outbounds, group))
                .collect()
        })
        .unwrap_or_default()
}

fn convert_rule(rule: &Json, outbounds: &[Json], group: &str) -> Vec<std::string::String> {
    if let Some(matcher) = UNSUPPORTED_MATCHERS.iter().find(|key| rule.get(**key).is_some()) {
        logging!(
            debug,
            Type::Config,
            "skipped an Xray routing rule matching on {matcher}"
        );
        return Vec::new();
    }
    let Some(target) = rule_target(rule, outbounds, group) else {
        logging!(
            debug,
            Type::Config,
            "skipped an Xray routing rule without a usable outbound"
        );
        return Vec::new();
    };
    let matchers: Vec<Vec<std::string::String>> = [
        values(rule.get("domain"), domain_rule),
        values(rule.get("ip"), ip_rule),
        values(rule.get("port"), port_rule),
        values(rule.get("network"), |network| {
            matches!(network, "tcp" | "udp").then(|| format!("NETWORK,{network}"))
        }),
    ]
    .into_iter()
    .flatten()
    .collect();
    if matchers.iter().any(Vec::is_empty) {
        logging!(
            debug,
            Type::Config,
            "skipped an Xray routing rule with unsupported values"
        );
        return Vec::new();
    }
    match matchers.as_slice() {
        [] => Vec::new(),
        [single] => single
            .iter()
            .map(|payload| match payload.strip_suffix(",no-resolve") {
                Some(payload) => format!("{payload},{target},no-resolve"),
                None => format!("{payload},{target}"),
            })
            .collect(),
        parts => logic_rule(parts, &target).into_iter().collect(),
    }
}

fn logic_rule(parts: &[Vec<std::string::String>], target: &str) -> Option<std::string::String> {
    if parts.iter().flatten().any(|payload| payload.contains(['(', ')'])) {
        return None;
    }
    let parts: Vec<std::string::String> = parts
        .iter()
        .map(|payloads| match payloads.as_slice() {
            [payload] => format!("({payload})"),
            _ => format!(
                "(OR,({}))",
                payloads
                    .iter()
                    .map(|payload| format!("({payload})"))
                    .collect::<Vec<_>>()
                    .join(",")
            ),
        })
        .collect();
    Some(format!("AND,({}),{target}", parts.join(",")))
}

fn rule_target(rule: &Json, outbounds: &[Json], group: &str) -> Option<std::string::String> {
    let tag = text(rule, "outboundTag")?;
    let protocol = outbounds
        .iter()
        .find(|outbound| text(outbound, "tag") == Some(tag))
        .and_then(|outbound| text(outbound, "protocol"));
    match (protocol, tag) {
        (Some("freedom"), _) | (None, "direct") => Some("DIRECT".into()),
        (Some("blackhole"), _) | (None, "block") => Some("REJECT".into()),
        (Some("dns"), _) => None,
        _ => Some(group.into()),
    }
}

fn values(
    value: Option<&Json>,
    convert: impl Fn(&str) -> Option<std::string::String>,
) -> Option<Vec<std::string::String>> {
    let items: Vec<std::string::String> = match value? {
        Json::Array(items) => items.iter().filter_map(scalar).collect(),
        Json::String(items) => items.split(',').map(str::to_owned).collect(),
        Json::Number(number) => vec![number.to_string()],
        _ => Vec::new(),
    };
    Some(
        items
            .iter()
            .map(|item| item.trim())
            .filter(|item| !item.is_empty() && !item.contains(','))
            .filter_map(convert)
            .collect(),
    )
}

fn domain_rule(value: &str) -> Option<std::string::String> {
    let (kind, domain) = match value.split_once(':') {
        Some(("geosite", code)) if !code.contains('@') => ("GEOSITE", code),
        Some(("domain", domain)) => ("DOMAIN-SUFFIX", domain),
        Some(("full", domain)) => ("DOMAIN", domain),
        Some(("keyword", keyword)) => ("DOMAIN-KEYWORD", keyword),
        Some(("regexp", pattern)) => ("DOMAIN-REGEX", pattern),
        Some(_) => return None,
        None => ("DOMAIN-KEYWORD", value),
    };
    (!domain.is_empty()).then(|| format!("{kind},{domain}"))
}

fn ip_rule(value: &str) -> Option<std::string::String> {
    if let Some(code) = value.strip_prefix("geoip:") {
        return (!code.is_empty() && !code.starts_with('!')).then(|| format!("GEOIP,{code},no-resolve"));
    }
    let (address, prefix) = value
        .split_once('/')
        .map_or((value, None), |(address, prefix)| (address, Some(prefix)));
    let address: IpAddr = address.parse().ok()?;
    let (kind, max) = if address.is_ipv4() {
        ("IP-CIDR", 32)
    } else {
        ("IP-CIDR6", 128)
    };
    let prefix = match prefix {
        Some(prefix) => prefix.parse::<u8>().ok().filter(|prefix| *prefix <= max)?,
        None => max,
    };
    Some(format!("{kind},{address}/{prefix},no-resolve"))
}

fn port_rule(value: &str) -> Option<std::string::String> {
    let valid = |port: &str| port.parse::<u16>().is_ok();
    let ok = match value.split_once('-') {
        Some((start, end)) => valid(start) && valid(end),
        None => valid(value),
    };
    ok.then(|| format!("DST-PORT,{value}"))
}

fn link_config(link: &str) -> Option<Json> {
    let (scheme, body) = link.split_once("://")?;
    let (name, outbound) = match scheme.to_ascii_lowercase().as_str() {
        "vmess" => vmess_link(body)?,
        "ss" => ss_link(body)?,
        "vless" | "trojan" | "hysteria2" | "hy2" => url_link(link)?,
        _ => return None,
    };
    Some(json!({ "remarks": name, "outbounds": [outbound] }))
}

fn url_link(link: &str) -> Option<(std::string::String, Json)> {
    let url = Url::parse(link).ok()?;
    let decode = |value: &str| percent_decode_str(value).decode_utf8_lossy().into_owned();
    let params: HashMap<std::string::String, std::string::String> = url.query_pairs().into_owned().collect();
    let server = url.host_str()?.trim_start_matches('[').trim_end_matches(']').to_owned();
    let port = url.port()?;
    let user = match url.password() {
        Some(password) => format!("{}:{}", decode(url.username()), decode(password)),
        None => decode(url.username()),
    };
    let name = url.fragment().map(decode).unwrap_or_default();
    let param = |key: &str| params.get(key).filter(|value| !value.is_empty());
    let outbound = match url.scheme() {
        "vless" => json!({
            "protocol": "vless",
            "settings": { "address": server, "port": port, "id": user, "flow": param("flow"), "encryption": param("encryption") },
            "streamSettings": link_stream(&params, "none"),
        }),
        "trojan" => json!({
            "protocol": "trojan",
            "settings": { "address": server, "port": port, "password": user },
            "streamSettings": link_stream(&params, "tls"),
        }),
        _ => json!({
            "protocol": "hysteria2",
            "settings": {
                "address": server,
                "port": port,
                "password": user,
                "obfs": { "type": param("obfs"), "password": param("obfs-password") },
            },
            "streamSettings": link_stream(&params, "tls"),
        }),
    };
    Some((name, outbound))
}

fn vmess_link(body: &str) -> Option<(std::string::String, Json)> {
    let config: Json = serde_json::from_str(&decode_base64_text(body)?).ok()?;
    let field = |key: &str| config.get(key).and_then(scalar).filter(|value| !value.is_empty());
    let mut params: HashMap<std::string::String, std::string::String> = [
        ("type", "net"),
        ("headerType", "type"),
        ("host", "host"),
        ("path", "path"),
        ("serviceName", "path"),
        ("sni", "sni"),
        ("alpn", "alpn"),
        ("fp", "fp"),
    ]
    .into_iter()
    .filter_map(|(param, key)| Some((param.to_owned(), field(key)?)))
    .collect();
    let security = if field("tls").as_deref() == Some("tls") {
        "tls"
    } else {
        "none"
    };
    params.insert("security".into(), security.into());
    let outbound = json!({
        "protocol": "vmess",
        "settings": {
            "address": field("add"),
            "port": field("port"),
            "id": field("id"),
            "alterId": field("aid").and_then(|aid| aid.parse::<u64>().ok()).unwrap_or(0),
            "security": field("scy"),
        },
        "streamSettings": link_stream(&params, "none"),
    });
    Some((field("ps").unwrap_or_default(), outbound))
}

fn ss_link(body: &str) -> Option<(std::string::String, Json)> {
    let (body, name) = body.split_once('#').unwrap_or((body, ""));
    let (body, query) = body.split_once('?').unwrap_or((body, ""));
    if query.split('&').any(|pair| pair.starts_with("plugin=")) {
        return None;
    }
    let body = body.trim_end_matches('/');
    let (userinfo, address) = match body.rsplit_once('@') {
        Some((userinfo, address)) => (
            decode_base64_text(userinfo)
                .filter(|decoded| decoded.contains(':'))
                .unwrap_or_else(|| percent_decode_str(userinfo).decode_utf8_lossy().into_owned()),
            address.to_owned(),
        ),
        None => {
            let decoded = decode_base64_text(body)?;
            let (userinfo, address) = decoded.rsplit_once('@')?;
            (userinfo.to_owned(), address.to_owned())
        }
    };
    let (method, password) = userinfo.split_once(':')?;
    let (server, port) = address.rsplit_once(':')?;
    let outbound = json!({
        "protocol": "shadowsocks",
        "settings": {
            "address": server.trim_start_matches('[').trim_end_matches(']'),
            "port": port,
            "method": method,
            "password": password,
        },
    });
    Some((percent_decode_str(name).decode_utf8_lossy().into_owned(), outbound))
}

fn link_stream(params: &HashMap<std::string::String, std::string::String>, default_security: &str) -> Json {
    let param = |key: &str| {
        params
            .get(key)
            .map(std::string::String::as_str)
            .filter(|value| !value.is_empty())
    };
    let network = param("type").unwrap_or("tcp");
    let (host, path) = (param("host"), param("path"));
    let (key, settings) = match network {
        "ws" => ("wsSettings", json!({ "path": path, "host": host })),
        "httpupgrade" => ("httpupgradeSettings", json!({ "path": path, "host": host })),
        "grpc" => ("grpcSettings", json!({ "serviceName": param("serviceName") })),
        "h2" | "http" => ("httpSettings", json!({ "path": path, "host": host })),
        "xhttp" | "splithttp" => (
            "xhttpSettings",
            json!({
                "path": path,
                "host": host,
                "mode": param("mode"),
                "extra": param("extra").and_then(|extra| serde_json::from_str::<Json>(extra).ok()),
            }),
        ),
        _ => (
            "tcpSettings",
            json!({ "header": { "type": param("headerType"), "request": { "path": path, "headers": { "Host": host } } } }),
        ),
    };
    let security = param("security").unwrap_or(default_security);
    let insecure = matches!(param("allowInsecure").or_else(|| param("insecure")), Some("1" | "true"));
    let mut stream = Map::new();
    stream.insert("network".into(), network.into());
    stream.insert(key.into(), settings);
    stream.insert("security".into(), security.into());
    stream.insert(
        "tlsSettings".into(),
        json!({ "serverName": param("sni"), "alpn": param("alpn"), "fingerprint": param("fp"), "allowInsecure": insecure }),
    );
    stream.insert(
        "realitySettings".into(),
        json!({ "serverName": param("sni"), "publicKey": param("pbk"), "shortId": param("sid"), "fingerprint": param("fp") }),
    );
    Json::Object(stream)
}

fn put(map: &mut Mapping, key: &str, value: impl Into<Value>) {
    map.insert(key.into(), value.into());
}

fn put_text(map: &mut Mapping, key: &str, value: Option<&str>) {
    if let Some(value) = value {
        put(map, key, value);
    }
}

fn text<'a>(value: &'a Json, key: &str) -> Option<&'a str> {
    value
        .get(key)?
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn scalar(value: &Json) -> Option<std::string::String> {
    match value {
        Json::String(value) => Some(value.trim().to_owned()),
        Json::Number(value) => Some(value.to_string()),
        _ => None,
    }
}

fn port_like(value: &Json) -> Option<u64> {
    match value {
        Json::Number(number) => number.as_u64(),
        Json::String(number) => number.trim().parse().ok(),
        _ => None,
    }
}

fn port(value: &Json) -> Option<u64> {
    port_like(value).filter(|port| (1..=65535).contains(port))
}

fn range(value: &Json) -> Option<Value> {
    match value {
        Json::Object(range) if range.contains_key("from") => {
            let from = range.get("from").and_then(port_like)?;
            let to = range.get("to").and_then(port_like).unwrap_or(from);
            Some(format!("{from}-{to}").into())
        }
        Json::String(value) if value.trim().is_empty() => None,
        Json::String(_) | Json::Number(_) | Json::Bool(_) => serde_yaml_ng::to_value(value).ok(),
        _ => None,
    }
}

fn list(value: Option<&Json>) -> Vec<Value> {
    let items: Vec<std::string::String> = match value {
        Some(Json::Array(items)) => items.iter().filter_map(scalar).collect(),
        Some(Json::String(items)) => items.split(',').map(str::to_owned).collect(),
        _ => Vec::new(),
    };
    items
        .into_iter()
        .map(|item| item.trim().to_owned())
        .filter(|item| !item.is_empty())
        .map(Value::from)
        .collect()
}

fn headers(value: Option<&Json>, as_list: bool) -> Mapping {
    let Some(headers) = value.and_then(Json::as_object) else {
        return Mapping::new();
    };
    headers
        .iter()
        .filter_map(|(key, value)| {
            let values = list(Some(value));
            let first = values.first()?.clone();
            Some((Value::from(key.as_str()), if as_list { values.into() } else { first }))
        })
        .collect()
}

#[cfg(test)]
#[allow(clippy::expect_used, clippy::unwrap_used, reason = "tests assert by panicking")]
mod tests {
    use super::convert_subscription;
    use base64::{Engine as _, engine::general_purpose};
    use serde_yaml_ng::{Mapping, Value};

    const KEY: &str = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE";
    const UUID: &str = "00000000-0000-0000-0000-000000000000";

    fn reality(server_name: &str) -> serde_json::Value {
        serde_json::json!({ "serverName": server_name, "publicKey": KEY, "shortId": "0123abcd", "fingerprint": "chrome" })
    }

    fn sample() -> std::string::String {
        let vless = |address: &str, user: serde_json::Value, stream: serde_json::Value| {
            serde_json::json!([
                { "tag": "proxy", "protocol": "vless", "settings": { "vnext": [{ "address": address, "port": 443, "users": [user] }] }, "streamSettings": stream },
                { "tag": "direct", "protocol": "freedom" },
                { "tag": "block", "protocol": "blackhole" },
            ])
        };
        serde_json::json!([
            {
                "remarks": " NL Reality ",
                "outbounds": vless(
                    "nl.example.com",
                    serde_json::json!({ "id": UUID, "flow": "xtls-rprx-vision", "encryption": "none" }),
                    serde_json::json!({ "network": "tcp", "security": "reality", "realitySettings": reality("www.example.com") }),
                ),
                "routing": { "rules": [
                    { "type": "field", "protocol": ["bittorrent"], "outboundTag": "direct" },
                    { "type": "field", "domain": ["geosite:category-ads-all"], "outboundTag": "block" },
                    { "type": "field", "domain": ["domain:example.ru", "full:www.example.org", "keyword:tracker", "regexp:^ads\\.", "example"], "outboundTag": "direct" },
                    { "type": "field", "ip": ["geoip:private", "10.0.0.0/8", "2001:db8::/32", "192.0.2.1"], "outboundTag": "direct" },
                    { "type": "field", "network": "udp", "port": "443", "outboundTag": "block" },
                    { "type": "field", "inboundTag": ["dns-in"], "outboundTag": "proxy" },
                ] },
            },
            {
                "remarks": "NL Reality",
                "outbounds": vless(
                    "xh.example.com",
                    serde_json::json!({ "id": UUID, "encryption": "none" }),
                    serde_json::json!({
                        "network": "xhttp",
                        "security": "reality",
                        "realitySettings": reality("www.example.com"),
                        "xhttpSettings": { "path": "/xh", "host": "cdn.example.com", "mode": "auto", "extra": {
                            "xPaddingBytes": "100-1000",
                            "scMaxEachPostBytes": { "from": 500000, "to": 1000000 },
                            "xmux": { "maxConcurrency": "16-32", "hMaxRequestTimes": "600-900" },
                            "downloadSettings": {
                                "address": "dl.example.com",
                                "port": 443,
                                "network": "xhttp",
                                "security": "tls",
                                "tlsSettings": { "serverName": "dl.example.com", "alpn": ["h2"], "fingerprint": "chrome" },
                                "xhttpSettings": { "path": "/dl", "host": "dl.example.com" },
                            },
                        } },
                    }),
                ),
            },
            {
                "remarks": "DE ENC",
                "outbounds": vless(
                    "de.example.com",
                    serde_json::json!({ "id": UUID, "encryption": format!("mlkem768x25519plus.native.0rtt.{KEY}") }),
                    serde_json::json!({ "network": "ws", "security": "tls", "tlsSettings": { "serverName": "de.example.com", "allowInsecure": true }, "wsSettings": { "path": "/ws", "headers": { "Host": "de.example.com" } } }),
                ),
            },
            {
                "remarks": "FI Trojan",
                "outbounds": [{
                    "tag": "proxy",
                    "protocol": "trojan",
                    "settings": { "servers": [{ "address": "fi.example.com", "port": 8443, "password": "secret" }] },
                    "streamSettings": { "network": "grpc", "security": "reality", "realitySettings": reality("www.example.com"), "grpcSettings": { "serviceName": "tun" } },
                }],
            },
        ])
        .to_string()
    }

    fn convert(data: &str, title: Option<&str>) -> Mapping {
        let yaml = convert_subscription(data, title).unwrap().expect("converted");
        serde_yaml_ng::from_str(&yaml).unwrap()
    }

    fn proxy<'a>(profile: &'a Mapping, name: &str) -> &'a Value {
        profile["proxies"]
            .as_sequence()
            .unwrap()
            .iter()
            .find(|proxy| proxy["name"].as_str() == Some(name))
            .expect(name)
    }

    #[test]
    fn xray_json_array_becomes_a_mihomo_profile() {
        let profile = convert(&sample(), Some("My VPN"));

        let tcp = proxy(&profile, "NL Reality");
        assert_eq!(tcp["type"].as_str(), Some("vless"));
        assert_eq!(tcp["flow"].as_str(), Some("xtls-rprx-vision"));
        assert_eq!(tcp["servername"].as_str(), Some("www.example.com"));
        assert_eq!(tcp["reality-opts"]["public-key"].as_str(), Some(KEY));
        assert!(tcp.get("encryption").is_none());

        let xhttp = proxy(&profile, "NL Reality 2");
        assert_eq!(xhttp["network"].as_str(), Some("xhttp"));
        let opts = &xhttp["xhttp-opts"];
        assert_eq!(opts["path"].as_str(), Some("/xh"));
        assert_eq!(opts["sc-max-each-post-bytes"].as_str(), Some("500000-1000000"));
        assert_eq!(opts["reuse-settings"]["max-concurrency"].as_str(), Some("16-32"));
        assert_eq!(opts["download-settings"]["server"].as_str(), Some("dl.example.com"));
        assert_eq!(opts["download-settings"]["path"].as_str(), Some("/dl"));

        let enc = proxy(&profile, "DE ENC");
        assert!(enc["encryption"].as_str().unwrap().starts_with("mlkem768x25519plus."));
        assert_eq!(enc["ws-opts"]["headers"]["Host"].as_str(), Some("de.example.com"));
        assert_eq!(enc["skip-cert-verify"].as_bool(), Some(true));

        let trojan = proxy(&profile, "FI Trojan");
        assert_eq!(trojan["password"].as_str(), Some("secret"));
        assert_eq!(trojan["sni"].as_str(), Some("www.example.com"));
        assert_eq!(trojan["grpc-opts"]["grpc-service-name"].as_str(), Some("tun"));

        let groups = profile["proxy-groups"].as_sequence().unwrap();
        assert_eq!(groups[0]["name"].as_str(), Some("My VPN"));
        assert_eq!(groups[0]["proxies"][0].as_str(), Some("⚡ Auto"));
        assert_eq!(groups[0]["proxies"].as_sequence().unwrap().len(), 5);
        assert_eq!(groups[1]["type"].as_str(), Some("url-test"));
        assert_eq!(groups[1]["proxies"].as_sequence().unwrap().len(), 4);

        let rules: Vec<&str> = profile["rules"]
            .as_sequence()
            .unwrap()
            .iter()
            .filter_map(Value::as_str)
            .collect();
        assert_eq!(
            rules,
            [
                "GEOSITE,category-ads-all,REJECT",
                "DOMAIN-SUFFIX,example.ru,DIRECT",
                "DOMAIN,www.example.org,DIRECT",
                "DOMAIN-KEYWORD,tracker,DIRECT",
                "DOMAIN-REGEX,^ads\\.,DIRECT",
                "DOMAIN-KEYWORD,example,DIRECT",
                "GEOIP,private,DIRECT,no-resolve",
                "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
                "IP-CIDR6,2001:db8::/32,DIRECT,no-resolve",
                "IP-CIDR,192.0.2.1/32,DIRECT,no-resolve",
                "AND,((DST-PORT,443),(NETWORK,udp)),REJECT",
                "MATCH,My VPN",
            ]
        );
        assert!(!profile.contains_key("dns") && !profile.contains_key("tun"));
    }

    #[test]
    fn share_links_are_converted_and_yaml_is_kept() {
        let links = [
            format!("vless://{UUID}@a.example.com:443?type=ws&security=tls&sni=a.example.com&path=%2Fws#A%20WS"),
            "trojan://secret@b.example.com:443?sni=b.example.com#B".into(),
            "hy2://auth@c.example.com:443?sni=c.example.com&obfs=salamander&obfs-password=mask#C".into(),
            format!(
                "ss://{}@d.example.com:8388#D",
                general_purpose::STANDARD.encode("aes-128-gcm:pass")
            ),
            "unknown://ignored".into(),
        ]
        .join("\n");
        let profile = convert(&general_purpose::STANDARD.encode(links), None);

        assert_eq!(proxy(&profile, "A WS")["ws-opts"]["path"].as_str(), Some("/ws"));
        assert_eq!(proxy(&profile, "B")["type"].as_str(), Some("trojan"));
        assert_eq!(proxy(&profile, "C")["obfs-password"].as_str(), Some("mask"));
        assert_eq!(proxy(&profile, "D")["cipher"].as_str(), Some("aes-128-gcm"));
        assert_eq!(profile["proxy-groups"][0]["name"].as_str(), Some("Proxy"));
        assert_eq!(profile["rules"][0].as_str(), Some("MATCH,Proxy"));

        assert!(convert_subscription("proxies: []\n", None).unwrap().is_none());
    }
}
