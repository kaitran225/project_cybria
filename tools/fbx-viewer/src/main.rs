mod inspect;

use std::path::{Path, PathBuf};

use eframe::egui;
use inspect::{inspect_fbx, InspectResult, UiNode};

const ASSET_DIR: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../asset/Milltina_ver1.01.1"
);

fn main() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1100.0, 720.0])
            .with_title("FBX Viewer (fbxcel)"),
        ..Default::default()
    };
    eframe::run_native(
        "FBX Viewer",
        options,
        Box::new(|cc| Ok(Box::new(FbxViewerApp::new(cc)))),
    )
}

struct FbxViewerApp {
    asset_dir: PathBuf,
    discovered_fbx: Vec<PathBuf>,
    selected_path: Option<PathBuf>,
    result: Option<InspectResult>,
    error: Option<String>,
    status: String,
    filter: String,
    show_attr_summary: bool,
}

impl FbxViewerApp {
    fn new(_cc: &eframe::CreationContext<'_>) -> Self {
        let asset_dir = PathBuf::from(ASSET_DIR);
        let discovered_fbx = discover_fbx_files(&asset_dir);
        let status = if discovered_fbx.is_empty() {
            "No .fbx files in asset/Milltina_ver1.01.1 — use Open FBX or drop a file.".into()
        } else {
            format!("Found {} .fbx file(s) in Milltina asset folder.", discovered_fbx.len())
        };

        Self {
            asset_dir,
            discovered_fbx,
            selected_path: None,
            result: None,
            error: None,
            status,
            filter: String::new(),
            show_attr_summary: true,
        }
    }

    fn load_path(&mut self, path: PathBuf) {
        self.selected_path = Some(path.clone());
        self.error = None;
        match inspect_fbx(&path) {
            Ok(result) => {
                self.status = format!(
                    "Loaded {} ({} nodes)",
                    path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("file"),
                    result.total_nodes
                );
                self.result = Some(result);
            }
            Err(err) => {
                self.result = None;
                self.error = Some(err);
                self.status = format!("Failed to load {}", path.display());
            }
        }
    }

    fn open_file_dialog(&mut self) {
        let start = self.asset_dir.parent().map(Path::to_path_buf);
        if let Some(path) = rfd::FileDialog::new()
            .add_filter("FBX binary", &["fbx"])
            .set_directory(start.unwrap_or_else(|| PathBuf::from(".")))
            .pick_file()
        {
            self.load_path(path);
        }
    }
}

impl eframe::App for FbxViewerApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        if !ctx.input(|i| i.raw.dropped_files.is_empty()) {
            let dropped: Vec<PathBuf> = ctx.input(|i| {
                i.raw
                    .dropped_files
                    .iter()
                    .filter_map(|f| f.path.clone())
                    .collect()
            });
            for path in dropped {
                if path.extension().and_then(|e| e.to_str()) == Some("fbx") {
                    self.load_path(path);
                    break;
                }
            }
        }

        egui::TopBottomPanel::top("toolbar").show(ctx, |ui| {
            ui.horizontal_wrapped(|ui| {
                ui.heading("FBX Viewer");
                ui.separator();
                if ui.button("Open FBX…").clicked() {
                    self.open_file_dialog();
                }
                if ui.button("Rescan asset folder").clicked() {
                    self.discovered_fbx = discover_fbx_files(&self.asset_dir);
                    self.status = if self.discovered_fbx.is_empty() {
                        "No .fbx files in asset/Milltina_ver1.01.1.".into()
                    } else {
                        format!("Found {} .fbx file(s).", self.discovered_fbx.len())
                    };
                }
                ui.checkbox(&mut self.show_attr_summary, "Show attribute summary");
            });
            ui.label(&self.status);
        });

        egui::SidePanel::left("files")
            .resizable(true)
            .default_width(280.0)
            .show(ctx, |ui| {
                ui.heading("Milltina assets");
                ui.label(
                    egui::RichText::new(self.asset_dir.display().to_string())
                        .small()
                        .weak(),
                );
                ui.separator();

                if self.discovered_fbx.is_empty() {
                    ui.label("This folder currently only has the Unity package readme.");
                    ui.add_space(8.0);
                    ui.label(
                        "Export or extract a binary .fbx from the .unitypackage, then open it here.",
                    );
                } else {
                    ui.label("FBX files:");
                    let discovered_paths = self.discovered_fbx.clone();
                    for path in &discovered_paths {
                        let name = path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("?");
                        let selected = self.selected_path.as_ref() == Some(path);
                        if ui.selectable_label(selected, name).clicked() {
                            self.load_path(path.clone());
                        }
                    }
                }
            });

        egui::CentralPanel::default().show(ctx, |ui| {
            if let Some(err) = &self.error {
                ui.colored_label(egui::Color32::RED, err);
                ui.add_space(8.0);
            }

            let Some(result) = &self.result else {
                ui.vertical_centered(|ui| {
                    ui.add_space(80.0);
                    ui.heading("Open a binary FBX file to inspect");
                    ui.label("Drag and drop a .fbx file, or use Open FBX…");
                    ui.add_space(12.0);
                    ui.label(format!("Default asset path: {}", self.asset_dir.display()));
                });
                return;
            };

            ui.horizontal(|ui| {
                ui.label(egui::RichText::new("File:").strong());
                ui.label(result.path.display().to_string());
            });
            ui.horizontal(|ui| {
                ui.label(egui::RichText::new("Size:").strong());
                ui.label(format_bytes(result.file_size));
                ui.separator();
                ui.label(egui::RichText::new("FBX version:").strong());
                ui.label(&result.version);
                ui.separator();
                ui.label(egui::RichText::new("Nodes:").strong());
                ui.label(result.total_nodes.to_string());
                ui.separator();
                ui.label(egui::RichText::new("Top-level:").strong());
                ui.label(result.top_level_nodes.to_string());
                ui.separator();
                ui.label(egui::RichText::new("Footer:").strong());
                ui.label(if result.footer_ok { "OK" } else { "Error" });
            });

            if !result.warnings.is_empty() {
                ui.add_space(6.0);
                ui.collapsing(
                    format!("Warnings ({})", result.warnings.len()),
                    |ui| {
                        for warning in &result.warnings {
                            ui.label(egui::RichText::new(warning).color(egui::Color32::YELLOW));
                        }
                    },
                );
            }

            ui.add_space(8.0);
            ui.horizontal(|ui| {
                ui.label("Filter nodes:");
                ui.text_edit_singleline(&mut self.filter);
            });
            ui.separator();

            egui::ScrollArea::both().show(ui, |ui| {
                for node in &result.tree {
                    if node_matches_filter(node, &self.filter) {
                        draw_node(ui, node, &self.filter, self.show_attr_summary, 0);
                    }
                }
            });
        });
    }
}

fn discover_fbx_files(dir: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    if !dir.is_dir() {
        return files;
    }
    let mut stack = vec![dir.to_path_buf()];
    while let Some(current) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&current) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path.extension().and_then(|e| e.to_str()) == Some("fbx") {
                files.push(path);
            }
        }
    }
    files.sort();
    files
}

fn node_matches_filter(node: &UiNode, filter: &str) -> bool {
    let filter = filter.trim().to_ascii_lowercase();
    if filter.is_empty() {
        return true;
    }
    if node.name.to_ascii_lowercase().contains(&filter) {
        return true;
    }
    node.children.iter().any(|c| node_matches_filter(c, &filter))
}

fn draw_node(
    ui: &mut egui::Ui,
    node: &UiNode,
    filter: &str,
    show_attrs: bool,
    depth: usize,
) {
    let label = if show_attrs && !node.attr_summary.is_empty() {
        format!("{}  [{}]", node.name, node.attr_summary)
    } else if node.attr_count > 0 {
        format!("{}  ({} attrs)", node.name, node.attr_count)
    } else {
        node.name.clone()
    };

    if node.children.is_empty() {
        ui.label(format!("{:indent$}{label}", "", indent = depth * 2));
        return;
    }

    egui::CollapsingHeader::new(label)
        .default_open(depth < 2)
        .show(ui, |ui| {
            for child in &node.children {
                if node_matches_filter(child, filter) {
                    draw_node(ui, child, filter, show_attrs, depth + 1);
                }
            }
        });
}

fn format_bytes(bytes: u64) -> String {
    const KB: f64 = 1024.0;
    let b = bytes as f64;
    if b < KB {
        format!("{bytes} B")
    } else if b < KB * KB {
        format!("{:.1} KB", b / KB)
    } else {
        format!("{:.2} MB", b / KB / KB)
    }
}
