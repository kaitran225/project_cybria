use std::{
    cell::RefCell,
    fs::File,
    io::BufReader,
    path::{Path, PathBuf},
    rc::Rc,
};

use fbxcel::{
    low::v7400::AttributeValue,
    pull_parser::any::AnyParser,
    tree::{any::AnyTree, v7400::NodeHandle},
};

#[derive(Clone)]
pub struct UiNode {
    pub name: String,
    pub attr_count: usize,
    pub attr_summary: String,
    pub children: Vec<UiNode>,
}

pub struct InspectResult {
    pub path: PathBuf,
    pub file_size: u64,
    pub version: String,
    pub top_level_nodes: usize,
    pub total_nodes: usize,
    pub footer_ok: bool,
    pub warnings: Vec<String>,
    pub tree: Vec<UiNode>,
}

pub fn inspect_fbx(path: &Path) -> Result<InspectResult, String> {
    let metadata = std::fs::metadata(path).map_err(|e| format!("Cannot read file: {e}"))?;
    let file_size = metadata.len();

    let file = File::open(path).map_err(|e| format!("Cannot open file: {e}"))?;
    let reader = BufReader::new(file);

    let warnings = Rc::new(RefCell::new(Vec::<String>::new()));
    let warnings_for_handler = Rc::clone(&warnings);

    let tree = match AnyParser::from_seekable_reader(reader).map_err(|e| format!("Parse error: {e}"))?
    {
        AnyParser::V7400(mut parser) => {
            parser.set_warning_handler(move |w, pos| {
                warnings_for_handler
                    .borrow_mut()
                    .push(format!("{w} (pos={pos:?})"));
                Ok(())
            });

            let version = parser.fbx_version();
            let loader = fbxcel::tree::v7400::Loader::new();
            let (fbx_tree, footer) = loader
                .load(&mut parser)
                .map_err(|e| format!("Tree load error: {e}"))?;

            AnyTree::V7400(version, fbx_tree, footer)
        }
        _ => return Err("Unsupported FBX parser version".into()),
    };

    match tree {
        AnyTree::V7400(version, fbx_tree, footer) => {
            let root = fbx_tree.root();
            let children: Vec<UiNode> = root.children().map(build_ui_node).collect();
            let total_nodes = count_nodes(root);
            let top_level_nodes = children.len();

            Ok(InspectResult {
                path: path.to_path_buf(),
                file_size,
                version: format!("{}.{} ({})", version.major(), version.minor(), version.major() * 1000 + version.minor() * 100),
                top_level_nodes,
                total_nodes,
                footer_ok: footer.is_ok(),
                warnings: Rc::try_unwrap(warnings)
                    .map(|c| c.into_inner())
                    .unwrap_or_default(),
                tree: children,
            })
        }
        _ => Err("Unsupported FBX tree version".into()),
    }
}

fn build_ui_node(handle: NodeHandle<'_>) -> UiNode {
    let attrs = handle.attributes();
    UiNode {
        name: handle.name().to_owned(),
        attr_count: attrs.len(),
        attr_summary: summarize_attributes(attrs),
        children: handle.children().map(build_ui_node).collect(),
    }
}

fn count_nodes(handle: NodeHandle<'_>) -> usize {
    1 + handle.children().map(count_nodes).sum::<usize>()
}

fn summarize_attributes(attrs: &[AttributeValue]) -> String {
    if attrs.is_empty() {
        return String::new();
    }

    let parts: Vec<String> = attrs.iter().take(4).map(attr_label).collect();
    if attrs.len() > 4 {
        format!("{}, … (+{})", parts.join(", "), attrs.len() - 4)
    } else {
        parts.join(", ")
    }
}

fn attr_label(value: &AttributeValue) -> String {
    match value {
        AttributeValue::String(s) => {
            let preview: String = s.chars().take(24).collect();
            if s.len() > 24 {
                format!("String(\"{preview}…\")")
            } else {
                format!("String(\"{preview}\")")
            }
        }
        AttributeValue::I16(v) => format!("I16({v})"),
        AttributeValue::I32(v) => format!("I32({v})"),
        AttributeValue::I64(v) => format!("I64({v})"),
        AttributeValue::F32(v) => format!("F32({v:.4})"),
        AttributeValue::F64(v) => format!("F64({v:.4})"),
        AttributeValue::Bool(v) => format!("Bool({v})"),
        AttributeValue::Binary(b) => format!("Binary({} bytes)", b.len()),
        AttributeValue::ArrBool(a) => format!("ArrBool[{}]", a.len()),
        AttributeValue::ArrI32(a) => format!("ArrI32[{}]", a.len()),
        AttributeValue::ArrI64(a) => format!("ArrI64[{}]", a.len()),
        AttributeValue::ArrF32(a) => format!("ArrF32[{}]", a.len()),
        AttributeValue::ArrF64(a) => format!("ArrF64[{}]", a.len()),
    }
}
