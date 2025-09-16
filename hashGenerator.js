const bcrypt = require('bcrypt');
const saltRounds = 10;

// --- Ganti password di bawah ini dengan yang Anda inginkan ---
const myPlaintextPassword = 'admin123'; 
// ----------------------------------------------------------

console.log(`Mencoba membuat hash untuk password: "${myPlaintextPassword}"`);

bcrypt.hash(myPlaintextPassword, saltRounds, function(err, hash) {
  if (err) {
    console.error("Error saat membuat hash:", err);
    return;
  }
  console.log("\nBerhasil! Ini hash password Anda:");
  console.log(hash);
  console.log("\nSilakan salin hash di atas dan gunakan dalam perintah SQL INSERT Anda.");
});
