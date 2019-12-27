'use strict';
const crypto = require('crypto');

const CIPHER = 'aes-256-cbc';

module.exports = ({
  // encrypts a string
  encrypt: (string, salt) => {
    let cipher = crypto.createCipher(CIPHER, salt);
    let encryptedString = cipher.update(string, 'utf-8', 'hex');
    return encryptedString + cipher.final('hex');
  },
  
  // decrypts a string
  decrypt: (string, salt) => {
    let decipher = crypto.createDecipher(CIPHER, salt);
    let decryptedString = decipher.update(string, 'hex', 'utf-8');
    return decryptedString + decipher.final('utf-8');    
  }
});

