const Verifier = artifacts.require("PlonkVerifier");

module.exports = function (deployer) {
  deployer.deploy(Verifier);
};
