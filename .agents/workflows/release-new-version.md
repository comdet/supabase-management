---
description: Automatically build, generate changelog, and push a new release to GitHub
---

# Release New Version Workflow

When the user triggers this workflow (e.g., via `/release-new-version`), you MUST perform the following steps sequentially to automatically release a new version of the application.

1. **Check Current Version & Determine New Version**:
   - Read `package.json` to extract the current `"version"` (e.g., `1.0.0`).
   - พิจารณาการขึ้นเวอร์ชันอย่างระมัดระวังตามหลักการ Semantic Versioning (SemVer):
     - **Major**: เมื่อมีการเปลี่ยนแปลงโครงสร้างใหญ่ หรือสร้าง Breaking Changes
     - **Minor**: เมื่อมีการเพิ่มฟีเจอร์ใหม่ที่ยังใช้งานร่วมกับของเดิมได้ (Backward compatible)
     - **Patch**: เมื่อเป็นเพียงแค่การแก้ไขบั๊ก (Bug fixes) หรือปรับแก้โค้ดเพียงเล็กน้อย
   - **สำคัญมาก:** ให้ตรวจสอบขนาดหน้างานและเนื้อหา Commit/Code ที่ถูกแก้ไขไปก่อนหน้า หากมีแค่แก้ไขเล็กน้อย หรือแก้แค่บั๊ก **ห้ามขึ้น Minor เด็ดขาด** ให้ใช้ Patch แทน
   - **หากไม่แน่ใจ หรือการประเมินดูคลุมเครือ:** ให้สอบถามผู้ใช้ (USER) ทันทีเพื่อขอยืนยันว่าควรขึ้นรูปแบบไหน อย่าปรับเวอร์ชันเองโดยพลการ

2. **Generate Changelog**:
   - Run `git log $(git describe --tags --abbrev=0)..HEAD --oneline` to view all commits since the last release tag.
   - Synthesize these logs into a clean, user-friendly **Changelog** (in Markdown format). 
   - Group the changes into categories like `✨ Features`, `🐛 Bug Fixes`, `🔒 Security`, etc.

3. **Update Version Numbers**:
   - Update the `"version"` field in `package.json` to the new version number.
   - Update the version badge in `README.md` (e.g., from `version-1.0.0-orange.svg` to the new version).

4. **Verify Build**:
   - Run `npm run build` to ensure the application builds successfully without completely breaking.

5. **Commit and Tag**: run line by line do not parallel, run and wait for result to config it actually execute.
   // turbo-all
   - `git add .`
   - `git commit -m "chore: release version v<NEW_VERSION>"`
   - `git tag v<NEW_VERSION>`
   - `git push origin main`
   - `git push origin v<NEW_VERSION>`

6. **Notify User**:
   - Once the final `git push` completes successfully, notify the user with the generated Changelog.
   - Inform them that the GitHub Action has been triggered and the `build.tar.gz` is being created in the background.