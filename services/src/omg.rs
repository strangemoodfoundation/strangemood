use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct OpenMetaGraph {
    version: String,
    elements: Vec<Element>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub enum Element {
    Value(ValueElement),
    Uri(UriElement),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ValueElement {
    pub key: String,
    #[serde(rename = "type")]
    pub content_type: String,
    pub value: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UriElement {
    pub key: String,
    #[serde(rename = "type")]
    pub content_type: String,
    pub uri: String,
}
