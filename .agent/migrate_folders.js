const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    let entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

try {
    console.log("Copying auth...");
    copyDir('src/app/api/database/auth', 'src/app/api/auth-users');
    console.log("Auth copied.");
} catch (e) { console.error(e.message); }

try {
    console.log("Copying functions...");
    copyDir('src/app/api/supabase/functions', 'src/app/api/functions');
    console.log("Functions copied.");
} catch (e) { console.error(e.message); }

try {
    console.log("Removing old auth...");
    fs.rmSync('src/app/api/database/auth', { recursive: true, force: true });
} catch (e) { console.error("Could not remove auth: " + e.message); }

try {
    console.log("Removing old functions...");
    fs.rmSync('src/app/api/supabase/functions', { recursive: true, force: true });
} catch (e) { console.error("Could not remove functions: " + e.message); }
