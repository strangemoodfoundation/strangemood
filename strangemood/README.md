# Strangemood

### Environment Setup
1. Install Rust from https://rustup.rs/
2. Install Solana from https://docs.solana.com/cli/install-solana-cli-tools#use-solanas-install-tool
3. Ensure that libssl is installed: `sudo apt install libssl-dev` (or `brew install openssl` on macOS)
4. Ensure libudev is installed: `sudo apt install libudev-dev`

### Build and test for program compiled natively
```
$ cargo build
$ cargo test
```

### Build and test the program compiled for BPF
```
$ cargo build-bpf
$ cargo test-bpf
```
