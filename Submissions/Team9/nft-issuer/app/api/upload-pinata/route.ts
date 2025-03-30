import { NextResponse } from "next/server";
import { PinataSDK } from "pinata-web3";
import crypto from "crypto";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: process.env.PINATA_GATEWAY!,
});

// Function to mask the ID (show first & last character, middle as ****)
const maskID = (id: string) => {
  if (id.length < 3) return id;
  return `${id[0]}****${id[id.length - 1]}`;
};

// Function to hash the ID using SHA-256
const hashID = (institution: string, idNumber: string) => {
  const data = JSON.stringify({ institution, idNumber }); // Convert to JSON
  return crypto.createHash("sha256").update(data).digest("hex");
};

// Function to generate a unique filename suffix
const generateUniqueSuffix = () => {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
};

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as Blob;
    const institution = formData.get("institution") as string;
    const position = formData.get("position") as string;
    const name = formData.get("name") as string;
    const idNumber = formData.get("idNumber") as string;

    if (!file || !institution || !position || !name || !idNumber) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Generate a unique identifier
    const uniqueSuffix = generateUniqueSuffix();

    // Format the filenames with unique suffix
    const formattedImageName =
      `${institution}_${position}_${name}_${uniqueSuffix}_identity_card.png`
        .replace(/\s+/g, "_") // Replace spaces with underscores
        .replace(/[^\w.-]/g, ""); // Remove special characters

    const formattedMetadataName =
      `${institution}_${position}_${name}_${uniqueSuffix}_metadata.json`
        .replace(/\s+/g, "_")
        .replace(/[^\w.-]/g, "");

    // Convert Blob to File
    const buffer = await file.arrayBuffer();
    const imageFile = new File([buffer], formattedImageName, {
      type: "image/png",
    });

    // Upload to Pinata
    const imageUpload = await pinata.upload.file(imageFile);
    if (!imageUpload.IpfsHash) {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const ipfsImageURI = `ipfs://${imageUpload.IpfsHash}`;
    const gatewayImageURI = `https://${process.env.PINATA_GATEWAY!}/ipfs/${imageUpload.IpfsHash}`;

    // Process ID transformations
    const idMasked = maskID(idNumber);
    const idHashed = hashID(institution, idNumber);

    // ✅ Create Structured Metadata JSON
    const metadata = {
      name,
      id_masked: idMasked,
      id_hashed: idHashed,
      institution,
      position,
      image: ipfsImageURI,
    };

    // Convert JSON to Blob
    const metadataBuffer = Buffer.from(JSON.stringify(metadata));

    // ✅ Convert metadata JSON to File
    const metadataFile = new File([metadataBuffer], formattedMetadataName, {
      type: "application/json",
    });

    // ✅ Upload Metadata JSON to Pinata
    const metadataUpload = await pinata.upload.file(metadataFile);
    if (!metadataUpload.IpfsHash) {
      return NextResponse.json(
        { error: "Metadata upload failed" },
        { status: 500 }
      );
    }

    const ipfsMetadataURI = `ipfs://${metadataUpload.IpfsHash}`;
    const gatewayMetadataURI = `https://${process.env.PINATA_GATEWAY!}/ipfs/${metadataUpload.IpfsHash}`;

    return NextResponse.json({
      ipfsMetadataURI,
      gatewayImageURI,
      gatewayMetadataURI,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
