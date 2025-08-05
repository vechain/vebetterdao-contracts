### Generating metadata for xApps

Metadata for xApps is a json file with the following structure:

```json
{
  "name": "RecycleRewards",
  "description": "RecycleRewards is a cutting-edge app that revolutionizes the way we approach recycling by providing tangible incentives in the form of tokens. This innovative platform not only promotes eco-friendly behavior but also establishes a rewarding system for users committed to making a positive impact on the environment.",
  "external_url": "https://openseacreatures.io/3",
  "logo": "ipfs://bafybeihjpb6yldfqgcydcnqwzpwlsckb4ypiwayzy3y4yurpbipsauspby/logo.png",
  "banner": "ipfs://bafybeihjpb6yldfqgcydcnqwzpwlsckb4ypiwayzy3y4yurpbipsauspby/banner.png",
  "screenshots": [],
  "social_urls": [
    {
      "name": "YouTube",
      "url": "https://www.youtube.com/@DLoaw"
    },
    {
      "name": "Instagram",
      "url": "https://www.instagram.com/@DLoaw"
    }
  ],
  "app_urls": [
    {
      "code": "play_store",
      "url": "https://www.playstore.com/@DLoaw"
    },
    {
      "code": "apple_store",
      "url": "https://www.applestore.com/@DLoaw"
    },
    {
      "code": "web_app",
      "url": "https://www.myapp.com"
    }
  ]
}
```

The `metadata/xApps` folder contains: a `src` folder and an `output` folder.
Each xApp should have a template file in the `src` folder containing the name, description, social urls, app urls, etc.
The `generate.ts` script will read the template file and search for the logo and banner in the `src/media` folder. It will upload the media files to IPFS and then generate a new json metadata file in the `output` folder. The name of the file will be the hash of the name of the xApp, since it's the unique identifier saved on-chain.

The `upload.ts` script will iterate through all files in the ouptut folder and upload each file to ipfs. Each CID will be printed on the console.

The CID will need to be set as the metadataURI of the app.

The contract will return the baseURI/metadataURI to the frontend, which will then use it to fetch the metadata from IPFS and display the xApp information.

## Important notes

The name of the file will be the hash of the name of the xApp, since it's the unique identifier saved on-chain. So please insert the same name in the template file as it is saved in the contract.
