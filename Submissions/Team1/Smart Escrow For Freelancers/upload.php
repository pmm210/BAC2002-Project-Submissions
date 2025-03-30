<?php
session_start();

// Pinata API
$PINATA_API_KEY = '8dfe2a7e36030c99e214';
$PINATA_SECRET_API_KEY = '0eb7c06ef82eef9cdbd5261819651654aec039cbd535be5d2a507c0e5d6865b9';

// Check if a file was uploaded and required POST fields are set
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['deliverable'], $_POST['clientAddress'], $_POST['encryptionKey'], $_POST['milestoneNumber'])) {
    $clientAddress = trim($_POST['clientAddress']);
    $encryptionKey = $_POST['encryptionKey'];
    $milestoneNumber = $_POST['milestoneNumber'];

    // Concatenate the client's address with the secret key
    $combinedKey = $clientAddress . $encryptionKey;
    
    // Derive a key from the concatenated string (binary outpu
    $key = hash('sha256', $combinedKey, true);

    // File details
    $fileTmpPath = $_FILES['deliverable']['tmp_name'];
    $originalFileName = $_FILES['deliverable']['name'];
    $fileName = 'milestone' . $milestoneNumber . '_' . $originalFileName; // Use the milestone number to adjust the file name dynamically
    $fileType = $_FILES['deliverable']['type'];  // MIME type (e.g. image/jpeg, text/plain, etc.)
    $fileContents = file_get_contents($fileTmpPath);

    // Generate a random 16-byte IV for AES-256-CBC encryption
    $iv = openssl_random_pseudo_bytes(16);

    // Encrypt the file using AES-256-CBC
    $encryptedData = openssl_encrypt($fileContents, "aes-256-cbc", $key, OPENSSL_RAW_DATA, $iv);
    if ($encryptedData === false) {
        // die("Encryption failed");

        header('Content-Type: application/json');
        echo json_encode(["success" => false, "message" => "Encryption failed"]);
        exit();
    }

    // Upload the encrypted file to IPFS via Pinata using cURL
    $url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
    
    // Use a temporary file for the encrypted data
    $tempEncFile = tempnam(sys_get_temp_dir(), 'enc');
    file_put_contents($tempEncFile, $encryptedData);

    $cfile = new CURLFile($tempEncFile, 'application/octet-stream', $fileName);
    
    $postFields = array(
        'file' => $cfile,
        'pinataMetadata' => json_encode(array("name" => $fileName))
    );

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        "pinata_api_key: $PINATA_API_KEY",
        "pinata_secret_api_key: $PINATA_SECRET_API_KEY"
    ));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $result = curl_exec($ch);
    if(curl_errno($ch)) {
        // die('Curl error: ' . curl_error($ch));

        header('Content-Type: application/json');
        echo json_encode(["success" => false, "message" => "Curl error: " . curl_error($ch)]);
        exit();
    }
    curl_close($ch);

    // Remove the temporary file
    unlink($tempEncFile);

    $resultData = json_decode($result, true);
    if (!isset($resultData['IpfsHash'])) {
        // die("IPFS upload failed: " . $result);

        header('Content-Type: application/json');
        echo json_encode(["success" => false, "message" => "IPFS upload failed: " . $result]);
        exit();
    }
    $ipfsCID = $resultData['IpfsHash'];

    // After processing your file upload and encryption:
    $data = [
        "ipfsCID" => $ipfsCID,
        "iv" => bin2hex($iv),
        "mimeType" => $fileType,
        "originalFileName" => $fileName,
        "milestoneNumber" => $milestoneNumber
    ];

    // Save to a file (this will overwrite the file on each upload)
    $filename = 'uploads' . '_' . 'milestone' . $milestoneNumber . '.json';
    file_put_contents($filename, json_encode($data));

    // Return a JSON response instead of a new UI
    header('Content-Type: application/json');
    echo json_encode([
        "success" => true,
        "ipfsCID" => $ipfsCID,
        "message" => "File Uploaded and Encrypted Successfully!"
    ]);
    exit();
} else {
    header('Content-Type: application/json');
    echo json_encode(["success" => false, "message" => "Invalid request."]);
    exit();
}
?>