use chrono::{Datelike, Timelike, Utc};
use rand::{thread_rng, Rng};

const NONCE_LENGTH: u16 = 64;

const NONCE_CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyz\
                            0123456789";

/// Create a random string as a nonce
pub fn generate_nonce() -> String {
    let mut rng = thread_rng();
    let rand_string: String = (0..NONCE_LENGTH)
        .map(|_| {
            let idx = rng.gen_range(0, NONCE_CHARSET.len());
            NONCE_CHARSET[idx] as char
        })
        .collect();

    return rand_string;
}

pub fn get_current_time() -> String {
    let now = Utc::now();
    let (_, year) = now.year_ce();

    return format!(
        "{}-{:02}-{:02} {:02}:{:02}:{:02}",
        year,
        now.month(),
        now.day(),
        now.hour(),
        now.minute(),
        now.second(),
    );
}
