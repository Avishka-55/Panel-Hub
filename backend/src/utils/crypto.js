const { encrypt, getMasterKey } = require('./encrypt');
const { decrypt } = require('./decrypt');

module.exports = {
  encrypt,
  decrypt,
  getMasterKey
};
