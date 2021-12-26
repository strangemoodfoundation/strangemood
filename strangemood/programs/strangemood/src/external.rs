use anchor_lang::prelude::ProgramError;
use spl_governance;
use std::io::Write;

#[derive(Clone)]
pub struct Realm(spl_governance::state::realm::Realm);

impl anchor_lang::AccountDeserialize for Realm {
    fn try_deserialize(buf: &mut &[u8]) -> Result<Self, ProgramError> {
        Realm::try_deserialize_unchecked(buf)
    }

    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self, ProgramError> {
        let mut data = buf;
        let realm: spl_governance::state::realm::Realm =
            anchor_lang::AnchorDeserialize::deserialize(&mut data)
                .map_err(|_| anchor_lang::__private::ErrorCode::AccountDidNotDeserialize)?;
        Ok(Realm(realm))
    }
}

impl anchor_lang::AccountSerialize for Realm {
    fn try_serialize<W: Write>(&self, _writer: &mut W) -> Result<(), ProgramError> {
        // no-op
        Ok(())
    }
}
