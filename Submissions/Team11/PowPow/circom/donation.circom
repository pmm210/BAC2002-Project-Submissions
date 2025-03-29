template DonationCircuit() {
    signal private input name_hash;   // Hash of donor's name
    signal private input email_hash;  // Hash of donor's email
    signal private input amount;      // Donation amount

    signal output public_name_hash;
    signal output public_email_hash;
    signal output public_amount;

    // Assign inputs to public outputs
    public_name_hash <== name_hash;
    public_email_hash <== email_hash;
    public_amount <== amount;
}

component main = DonationCircuit();