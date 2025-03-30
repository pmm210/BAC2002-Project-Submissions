import { ethers } from "ethers";
import UserRegistrationABI from "../build/contracts/UserRegistration.json";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

if (!contractAddress) {
  throw new Error("❌ Contract address is missing.");
}

const provider = new ethers.JsonRpcProvider("http://127.0.0.1:7545");

const getContract = (signer?: ethers.Signer) => {
  return new ethers.Contract(
    contractAddress,
    UserRegistrationABI.abi,
    signer || provider
  );
};

// ✅ Register a User
export const registerUser = async (
  adminSigner: ethers.Signer,
  userAddress: string,
  realName: string
) => {
  try {
    const contract = getContract(adminSigner);
    const tx = await contract.registerUser(userAddress, realName);
    await tx.wait();
    console.log(`✅ User registered: ${realName} - ${userAddress}`);
  } catch (error) {
    console.error("❌ Error registering user:", error);
  }
};

// ✅ Add Institution
export const addInstitution = async (
  adminSigner: ethers.Signer,
  userAddress: string,
  preferredName: string,
  idNumber: string,
  title: string,
  institution: string,
  phone: string,
  email: string
) => {
  try {
    const contract = getContract(adminSigner);
    const tx = await contract.addInstitution(
      userAddress,
      preferredName,
      idNumber,
      title,
      institution,
      phone,
      email
    );
    await tx.wait();
    console.log(`✅ Institution added: ${institution} - ${title}`);
  } catch (error) {
    console.error("❌ Error adding institution:", error);
  }
};

// ✅ Fetch All Users & Their Institutions
export const getAllUsersWithInstitutions = async () => {
  try {
    const contract = getContract();
    const [wallets, realNames, institutions] =
      await contract.getAllUsersWithInstitutions();

    let usersData = [];
    for (let i = 0; i < wallets.length; i++) {
      for (const inst of institutions[i]) {
        usersData.push({
          wallet: wallets[i],
          realName: realNames[i],
          preferredName: inst.preferredName,
          idNumber: inst.idNumber,
          title: inst.title,
          institution: inst.institution,
          phone: inst.phoneNumber,
          email: inst.email,
        });
      }
    }

    return usersData;
  } catch (error) {
    console.error("❌ Error fetching users & institutions:", error);
    return [];
  }
};
