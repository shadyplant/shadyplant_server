const fs = require("fs/promises");
const path = require("path");
const { initializeMongo, closeMongo } = require("../config/mongo");
const {
  applyProductGalleryImport,
  syncProductIdentifiers,
} = require("../repositories/product.repository");

const getGalleryFileFromArgs = () => {
  const galleryArgIndex = process.argv.findIndex(
    (argument) => argument === "--gallery-file",
  );

  if (galleryArgIndex >= 0 && process.argv[galleryArgIndex + 1]) {
    return process.argv[galleryArgIndex + 1];
  }

  return process.env.PRODUCT_GALLERY_IMPORT_FILE || "";
};

const loadGalleryEntries = async (galleryFile) => {
  if (!galleryFile) {
    return [];
  }

  const resolvedPath = path.resolve(process.cwd(), galleryFile);
  const rawFile = await fs.readFile(resolvedPath, "utf8");
  const parsedFile = JSON.parse(rawFile);

  if (!Array.isArray(parsedFile)) {
    throw new Error("Gallery import file must contain a JSON array.");
  }

  return parsedFile;
};

const run = async () => {
  await initializeMongo();

  const identifierCount = await syncProductIdentifiers();
  console.log(`Assigned product identifiers for ${identifierCount} product(s).`);

  const galleryFile = getGalleryFileFromArgs();
  if (galleryFile) {
    const galleryEntries = await loadGalleryEntries(galleryFile);
    const galleryResult = await applyProductGalleryImport(galleryEntries);
    console.log(
      `Gallery import matched ${galleryResult.matched} product(s) and updated ${galleryResult.updated} product(s).`,
    );
  } else {
    console.log(
      "No gallery import file provided. Skipped bulk product image update.",
    );
  }
};

run()
  .catch((error) => {
    console.error("Product catalog backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongo().catch(() => undefined);
  });
