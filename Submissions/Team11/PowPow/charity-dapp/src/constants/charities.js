export const CHARITIES = [
  {
    id: 1,
    name: "Save the Children",
    wallet: "0x3F4E0668F1365aC5fA70A5d0b4Aa5dD6D0E3a7e1",
    description: "Global child education initiatives",
    logo: "/logos/save-the-children.png",
  },
  {
    id: 2,
    name: "Water Aid",
    wallet: "0x8C327D1eCdF739AcC25f4A3E5B7a5F1C4B4e7D9f",
    description: "Clean water access worldwide",
    logo: "/logos/water-aid.png",
  },
  {
    id: 3,
    name: "manesh",
    wallet: "0x094B95B9E2EE00678733f6F0aD3DFe789c540432",
    description: "heho",
    logo: "/logos/water-aid.png",
  },
];

export const isRegisteredCharity = (address) => {
  return CHARITIES.some(
    (c) => c.wallet.toLowerCase() === address.toLowerCase()
  );
};
