use std::convert::TryInto;

use solana_program::pubkey::Pubkey;
use std::io::Write;

pub mod entrypoint;
pub mod error;
pub mod instruction;
pub mod processor;
pub mod state;

pub(crate) struct StrangemoodPDA {}
impl StrangemoodPDA {
    fn mint_authority(program_id: &Pubkey, mint: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[&mint.to_bytes()], &program_id)
    }
}

fn is_zero(slice: &[u8]) -> bool {
    for i in (0..slice.len()).step_by(16) {
        if slice.len() - i >= 16 {
            let arr: [u8; 16] = slice[i..i + 16]
                .try_into()
                .expect("this should always succeed");
            if u128::from_be_bytes(arr) != 0 {
                return false;
            }
        } else {
            for i in i..slice.len() {
                if slice[i] != 0 {
                    return false;
                }
            }
        }
    }
    return true;
}

fn fill_from_str(mut bytes: &mut [u8], s: &str) {
    bytes.write(s.as_bytes()).unwrap();
}
