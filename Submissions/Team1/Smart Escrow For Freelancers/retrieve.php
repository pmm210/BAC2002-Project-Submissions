<?php
session_start();

// We'll return JSON, so let's ensure we only output valid JSON.
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['clientAddress'], $_POST['decryptionKey'], $_POST['milestoneNumber'])) {
    $clientAddress   = trim($_POST['clientAddress']);
    $decryptionKey   = $_POST['decryptionKey'];
    $milestoneNumber = $_POST['milestoneNumber'];

    // Concatenate the client's address with the secret key
    $combinedKey = $clientAddress . $decryptionKey;

    // Derive a key from the concatenated string (binary output)
    $key         = hash('sha256', $combinedKey, true);

    // Read upload details from uploads_milestoneX.json
    $jsonFile = 'uploads' . '_' . 'milestone' . $milestoneNumber . '.json';
    if (!file_exists($jsonFile)) {
        echo json_encode(['success' => false, 'message' => 'No upload data found.']);
        exit;
    }

    $jsonData = json_decode(file_get_contents($jsonFile), true);
    if (!$jsonData) {
        echo json_encode(['success' => false, 'message' => 'Failed to parse uploads.json.']);
        exit;
    }

    // Check that all required keys exist in the JSON
    $requiredKeys = ['ipfsCID', 'iv', 'mimeType', 'originalFileName', 'milestoneNumber'];
    foreach ($requiredKeys as $rk) {
        if (!array_key_exists($rk, $jsonData)) {
            echo json_encode([
                'success' => false,
                'message' => "Missing key '{$rk}' in uploads.json."
            ]);
            exit;
        }
    }

    // Check that the milestone numbers match
    if ($jsonData['milestoneNumber'] !== $milestoneNumber) {
        echo json_encode(['success' => false, 'message' => 'Milestone number mismatch.']);
        exit;
    }

    // Extract details from the JSON file
    $ipfsCID = $jsonData['ipfsCID'];
    $ivHex = $jsonData['iv'];
    $mimeType = $jsonData['mimeType'];
    $originalFileName = $jsonData['originalFileName'];
    // Convert the stored IV (hex string) back to binary
    $iv = hex2bin($ivHex);

    // Retrieve the encrypted file from IPFS using a public gateway
    $ipfsUrl = "https://gateway.pinata.cloud/ipfs/" . $ipfsCID;
    $encryptedData = file_get_contents($ipfsUrl);
    if ($encryptedData === false || strlen($encryptedData) === 0) {
        echo json_encode([
            'success' => false,
            'message' => 'Failed to retrieve file from IPFS (empty or no response).'
        ]);
        exit;
    }

    // Attempt decryption
    $decryptedData = openssl_decrypt($encryptedData, "aes-256-cbc", $key, OPENSSL_RAW_DATA, $iv);

    // Start output buffering for HTML
    ob_start();

    if ($decryptedData === false) {
        // Decryption failed
        echo "<p style='color:red;'>Retrieval failed. Possibly the wrong secret passphrase or not the intended recipient.</p>";
        $success = false;
        exit;
    } else {
        // Decryption success
        echo "<p style='color:green;'>Retrieval Successful!</p>";
        $success = true;

        // Handle based on MIME type
        if (strpos($mimeType, "image/") === 0) {
            // For images: Display inline using an <img> tag 
            $base64Data = base64_encode($decryptedData);
            $dataUri = "data:" . $mimeType . ";base64," . $base64Data;
            echo "<h3>Image Preview:</h3>";
            echo "<img src='{$dataUri}' alt='Decrypted Image' style='max-width:100%; height:auto; border:1px solid #ccc;'><br><br>";
            echo "<a href='{$dataUri}' download='" . htmlspecialchars($originalFileName) . "'>Download Decrypted File</a>";
        } elseif (strpos($mimeType, "text/") === 0) {
            // For text files: Display text content in a <pre>
            $decryptedText = htmlspecialchars($decryptedData);
            echo "<h3>Text File Content:</h3>";
            echo "<pre>{$decryptedText}</pre>";
            // Provide a download link by converting to a data URI
            $base64Data = base64_encode($decryptedData);
            $dataUri = "data:" . $mimeType . ";base64," . $base64Data;
            echo "<br><a href='{$dataUri}' download='" . htmlspecialchars($originalFileName) . "'>Download Decrypted File</a>";
        } else {
            // For PDFs, videos, or other binary files: Offer a download link
            $base64Data = base64_encode($decryptedData);
            $dataUri = "data:" . $mimeType . ";base64," . $base64Data;
            echo "<p>The decrypted file cannot be directly previewed. Use the link below to download it.</p>";
            echo "<a href='{$dataUri}' download='" . htmlspecialchars($originalFileName) . "'>Download Decrypted File</a>";
        }
    }

    // Capture all the echoed output into a variable
    $htmlOutput = ob_get_clean();

    // Return a JSON response with the HTML content
    echo json_encode(['success' => $success, 'html' => $htmlOutput]);
    exit;
} else {
    // If not a valid POST with required fields, respond with JSON error
    echo json_encode(['success' => false, 'message' => 'Invalid request. Required fields missing.']);
    exit;
}
