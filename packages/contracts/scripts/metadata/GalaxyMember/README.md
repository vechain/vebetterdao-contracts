## 🌌 Galaxy Member Metadata & Image Upload (IPFS)

This flow handles generating and uploading Galaxy Member metadata and images to IPFS. Each image is uploaded individually and linked in the metadata with its own CID — improving reliability and UX.

### ⚙️ Available Commands

#### **Testnet**

```bash
#Uploads images and generate metadata based on the uploaded CIDs
yarn contracts:generate-galaxy-member-metadata:ipfs-dev

#Run the command above + upload the generated metadata
yarn contracts:upload-galaxy-member-metadata:ipfs-dev
```

#### **Mainnet**

```bash
#Uploads images and generate metadata based on the uploaded CIDs
yarn contracts:generate-galaxy-member-metadata:ipfs-prod

#Run the command above + upload the generated metadata
yarn contracts:upload-galaxy-member-metadata:ipfs-prod
```

### 🖼 Adding a New Level

1. Add a new object to the `GM_IMAGES_DATA` array in `consts.ts`:

   ```ts
   export const GM_IMAGES_DATA: ImageData[] = [
     {
       levelName: "Earth",
       levelAttributes: {
         Level: 1,
       },
     },
     // ...
     {
       levelName: "Saturn",
       levelAttributes: {
         Level: 7,
       },
     },
   ]
   ```

2. Add the new image file to `/images` as `7.png`.

### ⚠️ Image Requirements

To ensure smooth uploads and better UX:

- **Image must be ~1MB max**
- **Optimize** the image before uploading (e.g., using [Compress PNG](https://compresspng.com) or CLI tools)
- **Remove EXIF metadata** using a tool like:

  ```bash
  exiftool -all= ./images/7.png
  ```
