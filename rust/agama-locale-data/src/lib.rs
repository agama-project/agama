use serde::Deserialize;

pub fn add(left: usize, right: usize) -> usize {
    left + right
}

#[derive(Debug, Deserialize)]
pub struct RankedLanguage {
    pub id: String,
    pub rank: u8
}

#[derive(Debug, Deserialize)]
pub struct RankedTerritory {
    #[serde(rename(deserialize = "territoryId"))]
    pub id: String,
    pub rank: u8
}

#[derive(Debug, Deserialize)]
pub struct Keyboard {
    pub id: String,
    pub description: String,
    pub ascii: bool,
    pub comment: String,
    pub languages: Vec<RankedLanguage>,
    pub territories: Vec<RankedTerritory>
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}
