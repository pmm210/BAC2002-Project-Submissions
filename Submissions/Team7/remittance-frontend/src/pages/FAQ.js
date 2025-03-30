import React from "react";
import { Container, Accordion, Card } from "react-bootstrap";
import PageWrapper from "../components/PageWrapper";

const FAQ = () => {
  const faqs = [
    {
      question: "How does the remittance platform work?",
      answer: "Our platform uses blockchain technology to enable fast, low-cost international money transfers. When you send money, we convert your cryptocurrency into the stablecoin of your choice and deliver it directly to the recipient's wallet. The entire process happens in a single transaction, reducing gas fees and processing time."
    },
    {
      question: "What cryptocurrencies can I use to send money?",
      answer: "We support a wide range of cryptocurrencies including ETH, BTC, MATIC, and many others. You can see the full list of supported cryptocurrencies when you connect your wallet and initiate a transaction."
    },
    {
      question: "What stablecoins can the recipient receive?",
      answer: "Recipients can receive various stablecoins including USDC, USDT, DAI, and SGD. You can select which stablecoin the recipient should receive during the transaction process."
    },
    {
      question: "How long do transfers take?",
      answer: "Transfers typically complete within minutes, as opposed to traditional remittance services that can take 1-5 business days. The exact time depends on blockchain network congestion, but is generally much faster than traditional banking transfers."
    },
    {
      question: "What are the fees?",
      answer: "Our platform charges a 0.5% fee per transaction. There are also small network fees (gas fees) for processing the transaction on the blockchain. Even with these fees, our total costs are significantly lower than traditional remittance services which often charge 3-7%."
    },
    {
      question: "Do I need a wallet to use the platform?",
      answer: "Yes, you need a Web3 wallet like MetaMask to send money through our platform. The recipient also needs a wallet to receive the funds. If you're new to cryptocurrency, we recommend setting up MetaMask, which is free and easy to use."
    },
    {
      question: "Is my transaction information private?",
      answer: "All transaction details are stored securely. While blockchain transactions are publicly visible on the network, they don't contain personal identifying information beyond wallet addresses."
    },
    {
      question: "What happens if I send to the wrong address?",
      answer: "Blockchain transactions are irreversible once confirmed. Always double-check the recipient address before confirming your transaction. We cannot recover funds sent to incorrect addresses."
    },
    {
      question: "What countries do you support?",
      answer: "Our platform works globally as it's based on blockchain technology, which isn't restricted by national borders. However, users should comply with their local regulations regarding cryptocurrency usage."
    },
    {
      question: "How do I track my transaction?",
      answer: "Once your transaction is submitted, you can track its status in the Transactions section of your account. You can also view the transaction on the blockchain explorer by clicking the transaction hash."
    },
    {
      question: "What if the recipient doesn't have a cryptocurrency wallet?",
      answer: "The recipient must have a cryptocurrency wallet to receive funds. If they don't have one, they can easily create a free wallet using services like MetaMask. We provide setup guides in our Help section."
    },
    {
      question: "Are there any limits on how much I can send?",
      answer: "There are no platform-imposed limits on transaction amounts. However, depending on your location, there may be regulatory requirements for large transfers."
    },
    {
      question: "How are fees bundled in a single transaction?",
      answer: "One of the key advantages of our platform is how we bundle multiple steps into a single transaction. Traditional remittance services charge separate fees for deposit, currency conversion, international transfer, and withdrawal - often adding up to 6.2% or more of the total amount. Our smart contract technology combines token conversion and transfer into one atomic transaction, dramatically reducing the total fees to just 0.5-1% of the transfer amount. This means you save money and time, as everything happens in a single step rather than multiple separated processes."
    },
  ];

  return (
    <PageWrapper>
      <Container className="my-5">
        <h1 className="mb-3">Frequently Asked Questions</h1>
        <p className="lead mb-5">
          Find answers to the most common questions about our remittance platform.
        </p>

        <Accordion defaultActiveKey="0" className="mb-5">
          {faqs.map((faq, index) => (
            <Accordion.Item eventKey={index.toString()} key={index}>
              <Accordion.Header>{faq.question}</Accordion.Header>
              <Accordion.Body>
                {faq.answer}
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>

        <Card className="bg-light border-0">
          <Card.Body className="text-center">
            <h4>Still have questions?</h4>
            <p className="mb-0">
              Contact our support team at <a href="mailto:support@remittance-platform.com">support@remittance-platform.com</a>
            </p>
          </Card.Body>
        </Card>
      </Container>
    </PageWrapper>
  );
};

export default FAQ;