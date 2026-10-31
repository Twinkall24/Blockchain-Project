module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,          // Ganache Desktop default port
      network_id: "*",     // Match any network id
      gas: 6721975,        // Gas limit – matches Ganache default
      gasPrice: 20000000000
    }
  },
  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        viaIR: true,
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  }
};
