use crate::{config::Config, core::handle, process::AsyncHandler, utils::window_manager::WindowManager};
use clash_verge_logging::{Type, logging, logging_error};
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, Instant};
use tauri::webview::PageLoadEvent;
use tauri::{
    Manager as _, PhysicalPosition, Rect, Theme, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};

pub const QUICK_PANEL_LABEL: &str = "quick-panel";

const WIDTH: f64 = 340.0;
const HEIGHT: f64 = 520.0;
const MARGIN: f64 = 8.0;
const REOPEN_GRACE: Duration = Duration::from_millis(300);
const IDLE_DESTROY_DELAY: Duration = Duration::from_secs(20);

#[cfg(not(target_os = "macos"))]
const DARK_BACKGROUND: tauri::utils::config::Color = tauri::utils::config::Color(10, 10, 10, 255);
#[cfg(not(target_os = "macos"))]
const LIGHT_BACKGROUND: tauri::utils::config::Color = tauri::utils::config::Color(255, 255, 255, 255);

static HIDDEN_AT: Mutex<Option<Instant>> = Mutex::new(None);
static SHOW_ON_LOAD: AtomicBool = AtomicBool::new(false);
static DESTROY_GENERATION: AtomicU64 = AtomicU64::new(0);
static DESTROYED_AS_LAST_WINDOW: AtomicBool = AtomicBool::new(false);

type Area = (f64, f64, f64, f64);

fn get_window() -> Option<WebviewWindow> {
    handle::Handle::app_handle().get_webview_window(QUICK_PANEL_LABEL)
}

pub async fn toggle(anchor: Option<Rect>) {
    if let Some(window) = get_window()
        && window.is_visible().unwrap_or(false)
    {
        hide();
        return;
    }
    if HIDDEN_AT.lock().is_some_and(|at| at.elapsed() < REOPEN_GRACE) {
        return;
    }
    show(anchor).await;
}

async fn show(anchor: Option<Rect>) {
    DESTROY_GENERATION.fetch_add(1, Ordering::AcqRel);
    let window = match get_window() {
        Some(window) => window,
        None => match build_window().await {
            Ok(window) => window,
            Err(err) => {
                logging!(error, Type::Window, "Failed to create quick panel: {err}");
                return;
            }
        },
    };
    place(&window, anchor);
    if SHOW_ON_LOAD.load(Ordering::Acquire) {
        return;
    }
    logging_error!(Type::Window, window.show());
    logging_error!(Type::Window, window.set_focus());
}

pub fn hide() {
    let Some(window) = get_window() else {
        return;
    };
    *HIDDEN_AT.lock() = Some(Instant::now());
    logging_error!(Type::Window, window.hide());
    schedule_destroy();
}

fn schedule_destroy() {
    let generation = DESTROY_GENERATION.fetch_add(1, Ordering::AcqRel) + 1;
    AsyncHandler::spawn(move || async move {
        tokio::time::sleep(IDLE_DESTROY_DELAY).await;
        if DESTROY_GENERATION.load(Ordering::Acquire) != generation {
            return;
        }
        if let Some(window) = get_window()
            && !window.is_visible().unwrap_or(false)
        {
            logging!(debug, Type::Window, "Destroying idle quick panel");
            logging_error!(Type::Window, window.destroy());
        }
    });
}

pub fn handle_window_event(event: &WindowEvent) {
    match event {
        WindowEvent::Focused(false) => hide(),
        WindowEvent::CloseRequested { api, .. } if !handle::Handle::global().is_exiting() => {
            api.prevent_close();
            hide();
        }
        WindowEvent::Destroyed => {
            SHOW_ON_LOAD.store(false, Ordering::Release);
            DESTROYED_AS_LAST_WINDOW.store(WindowManager::get_main_window().is_none(), Ordering::Release);
        }
        _ => {}
    }
}

pub fn take_destroyed_as_last_window() -> bool {
    DESTROYED_AS_LAST_WINDOW.swap(false, Ordering::AcqRel)
}

async fn build_window() -> tauri::Result<WebviewWindow> {
    let theme = match Config::verge().await.latest_arc().theme_mode.as_deref() {
        Some("dark") => Some(Theme::Dark),
        Some("light") => Some(Theme::Light),
        _ => None,
    };

    SHOW_ON_LOAD.store(true, Ordering::Release);
    let builder = WebviewWindowBuilder::new(
        handle::Handle::app_handle(),
        QUICK_PANEL_LABEL,
        WebviewUrl::App("quick-panel.html".into()),
    )
    .title("Moclash")
    .inner_size(WIDTH, HEIGHT)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .decorations(false)
    .shadow(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible_on_all_workspaces(true)
    .visible(false)
    .focused(true)
    .theme(theme)
    .general_autofill_enabled(false)
    .on_page_load(|window, payload| {
        if payload.event() == PageLoadEvent::Finished && SHOW_ON_LOAD.swap(false, Ordering::AcqRel) {
            logging_error!(Type::Window, window.show());
            logging_error!(Type::Window, window.set_focus());
        }
    });

    #[cfg(target_os = "macos")]
    let builder = builder
        .transparent(true)
        .background_color(tauri::utils::config::Color(0, 0, 0, 0));

    #[cfg(not(target_os = "macos"))]
    let builder = {
        let dark = theme.map_or_else(
            || !matches!(dark_light::detect().ok(), Some(dark_light::Mode::Light)),
            |theme| theme == Theme::Dark,
        );
        builder.background_color(if dark { DARK_BACKGROUND } else { LIGHT_BACKGROUND })
    };

    builder
        .build()
        .inspect_err(|_| SHOW_ON_LOAD.store(false, Ordering::Release))
}

fn place(window: &WebviewWindow, anchor: Option<Rect>) {
    let app = handle::Handle::app_handle();
    let scale = window.scale_factor().unwrap_or(1.0);
    let icon = anchor.map(|rect| {
        let position = rect.position.to_physical::<f64>(scale);
        let size = rect.size.to_physical::<f64>(scale);
        (position.x, position.y, size.width, size.height)
    });

    let monitors = app.available_monitors().unwrap_or_default();
    let monitor = icon
        .and_then(|(x, y, w, h)| {
            let (cx, cy) = (x + w / 2.0, y + h / 2.0);
            monitors.iter().find(|monitor| {
                let position = monitor.position();
                let size = monitor.size();
                cx >= f64::from(position.x)
                    && cx < f64::from(position.x) + f64::from(size.width)
                    && cy >= f64::from(position.y)
                    && cy < f64::from(position.y) + f64::from(size.height)
            })
        })
        .cloned()
        .or_else(|| app.primary_monitor().ok().flatten())
        .or_else(|| monitors.first().cloned());
    let Some(monitor) = monitor else {
        return;
    };

    let monitor_scale = monitor.scale_factor();
    let work_area = monitor.work_area();
    let area = (
        f64::from(work_area.position.x),
        f64::from(work_area.position.y),
        f64::from(work_area.size.width),
        f64::from(work_area.size.height),
    );
    let panel = (WIDTH * monitor_scale, HEIGHT * monitor_scale);
    let margin = MARGIN * monitor_scale;
    let (x, y) = panel_origin(icon, area, panel, margin);
    logging_error!(
        Type::Window,
        window.set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32))
    );
}

fn panel_origin(icon: Option<Area>, area: Area, panel: (f64, f64), margin: f64) -> (f64, f64) {
    let (ax, ay, aw, ah) = area;
    let (pw, ph) = panel;
    let (x, y) = match icon {
        None => (ax + aw - pw - margin, ay + margin),
        Some((ix, iy, iw, ih)) => {
            let (cx, cy) = (ix + iw / 2.0, iy + ih / 2.0);
            if cy < ay {
                (cx - pw / 2.0, ay + margin)
            } else if cy > ay + ah {
                (cx - pw / 2.0, ay + ah - ph - margin)
            } else if cx < ax {
                (ax + margin, cy - ph / 2.0)
            } else if cx > ax + aw {
                (ax + aw - pw - margin, cy - ph / 2.0)
            } else if cy > ay + ah / 2.0 {
                (cx - pw / 2.0, iy - ph - margin)
            } else {
                (cx - pw / 2.0, iy + ih + margin)
            }
        }
    };
    (
        x.clamp(ax + margin, (ax + aw - pw - margin).max(ax + margin)),
        y.clamp(ay + margin, (ay + ah - ph - margin).max(ay + margin)),
    )
}
