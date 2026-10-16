use crate::config::Config;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use sha2::{Digest as _, Sha256};
use std::sync::OnceLock;

const HWID_LEN: usize = 16;

static DEVICE_HWID: OnceLock<std::string::String> = OnceLock::new();

#[cfg(target_os = "windows")]
fn read_registry_value(path: &str, name: &str) -> Option<std::string::String> {
    use winreg::{
        RegKey,
        enums::{HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_64KEY},
    };

    RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey_with_flags(path, KEY_READ | KEY_WOW64_64KEY)
        .ok()?
        .get_value::<std::string::String, _>(name)
        .ok()
}

#[cfg(target_os = "macos")]
fn run_command(program: &str, args: &[&str]) -> Option<std::string::String> {
    let output = std::process::Command::new(program).args(args).output().ok()?;
    output
        .status
        .success()
        .then(|| std::string::String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

#[cfg(target_os = "windows")]
fn machine_id() -> Option<std::string::String> {
    read_registry_value(r"SOFTWARE\Microsoft\Cryptography", "MachineGuid")
}

#[cfg(target_os = "macos")]
fn machine_id() -> Option<std::string::String> {
    let output = run_command("ioreg", &["-rd1", "-c", "IOPlatformExpertDevice"])?;
    output
        .lines()
        .find(|line| line.contains("\"IOPlatformUUID\""))
        .and_then(|line| line.rsplit('"').nth(1))
        .map(str::to_owned)
}

#[cfg(target_os = "linux")]
fn machine_id() -> Option<std::string::String> {
    ["/etc/machine-id", "/var/lib/dbus/machine-id"]
        .iter()
        .find_map(|path| std::fs::read_to_string(path).ok())
        .map(|id| id.trim().to_owned())
}

const fn device_os() -> &'static str {
    if cfg!(target_os = "windows") {
        "Windows"
    } else if cfg!(target_os = "macos") {
        "macOS"
    } else {
        "Linux"
    }
}

#[cfg(target_os = "windows")]
fn os_version() -> Option<std::string::String> {
    let key = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion";
    let build = read_registry_value(key, "CurrentBuildNumber")?;
    Some(format!("10.0.{build}"))
}

#[cfg(target_os = "macos")]
fn os_version() -> Option<std::string::String> {
    run_command("sw_vers", &["-productVersion"])
}

#[cfg(target_os = "linux")]
fn os_version() -> Option<std::string::String> {
    let release = std::fs::read_to_string("/etc/os-release").ok()?;
    let field = |key: &str| {
        release
            .lines()
            .find_map(|line| line.strip_prefix(key))
            .map(|value| value.trim_matches('"').to_owned())
    };
    match (field("NAME="), field("VERSION_ID=")) {
        (Some(name), Some(version)) => Some(format!("{name} {version}")),
        (name, version) => name.or(version),
    }
}

#[cfg(target_os = "windows")]
fn device_model() -> Option<std::string::String> {
    read_registry_value(r"HARDWARE\DESCRIPTION\System\BIOS", "SystemProductName")
}

#[cfg(target_os = "macos")]
fn device_model() -> Option<std::string::String> {
    run_command("sysctl", &["-n", "hw.model"])
}

#[cfg(target_os = "linux")]
fn device_model() -> Option<std::string::String> {
    std::fs::read_to_string("/sys/devices/virtual/dmi/id/product_name")
        .ok()
        .map(|model| model.trim().to_owned())
}

fn hostname() -> std::string::String {
    gethostname::gethostname().to_string_lossy().into_owned()
}

pub fn device_hwid() -> &'static str {
    DEVICE_HWID.get_or_init(|| {
        let raw = machine_id().filter(|id| !id.trim().is_empty()).unwrap_or_else(hostname);
        let digest = Sha256::digest(raw.trim().as_bytes());
        let mut hwid = digest
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<std::string::String>();
        hwid.truncate(HWID_LEN);
        hwid
    })
}

fn insert_header(headers: &mut HeaderMap, name: &'static str, value: Option<std::string::String>) {
    let Some(value) = value
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
    else {
        return;
    };
    if let Ok(value) = HeaderValue::from_str(&value) {
        headers.insert(HeaderName::from_static(name), value);
    }
}

pub async fn subscription_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();
    let verge = Config::verge().await.data_arc();
    if !verge.enable_send_hwid.unwrap_or(false) {
        return headers;
    }

    let hwid = verge
        .custom_hwid
        .as_deref()
        .map(str::trim)
        .filter(|hwid| !hwid.is_empty())
        .map_or_else(|| device_hwid().to_owned(), str::to_owned);

    insert_header(&mut headers, "x-hwid", Some(hwid));
    insert_header(&mut headers, "x-device-os", Some(device_os().to_owned()));
    insert_header(&mut headers, "x-ver-os", os_version());
    insert_header(
        &mut headers,
        "x-device-model",
        device_model().or_else(|| Some(hostname())),
    );
    headers
}
