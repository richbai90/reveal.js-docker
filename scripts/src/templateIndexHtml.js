// /scripts/src/templateWithEjs.js

const fs = require("fs");
const path = require("path");
const ejs = require("ejs");

// Start with default configuration
let config = {
  webFolder: "/reveal",
  resourceFolder: "/resources",
  inputTemplate: "/reveal/index.ejs",
  outputHtml: "/reveal/index.html",
  title: "cloudogu/reveal.js-docker",
  themeCss: "cloudogu.css",
  additionalPlugins: "",
  additionalRevealOptions: "",
  showNotesForPrinting: "false",
  width: "",
  height: "",
  margin: "",
  minScale: "",
  maxScale: "",
  baseURL: "",
  additionalScripts: [],
};

// Set resource folder from environment or use default
const resourceFolder = process.env.RESOURCE_FOLDER || "/resources";

// Load config from JSON file if it exists
if (fs.existsSync(`${resourceFolder}/config.json`)) {
  try {
    console.log(`Loading configuration from ${resourceFolder}/config.json`);
    const fileContent = fs.readFileSync(
      `${resourceFolder}/config.json`,
      "utf8",
    );
    const jsonConfig = JSON.parse(fileContent);
    config = { ...config, ...jsonConfig };
    console.log("JSON configuration loaded successfully");
  } catch (error) {
    console.warn(`Warning: Error loading config.json: ${error.message}`);
  }
}

// Override with environment variables, but only if they're defined
Object.entries({
  WEB_FOLDER: "webFolder",
  INPUT_INDEX_HTML_TEMPLATE: "inputTemplate",
  OUTPUT_INDEX_HTML: "outputHtml",
  TITLE: "title",
  THEME_CSS: "themeCss",
  ADDITIONAL_PLUGINS: "additionalPlugins",
  ADDITIONAL_REVEAL_OPTIONS: "additionalRevealOptions",
  SHOW_NOTES_FOR_PRINTING: "showNotesForPrinting",
  WIDTH: "width",
  HEIGHT: "height",
  MARGIN: "margin",
  MIN_SCALE: "minScale",
  MAX_SCALE: "maxScale",
  BASE_URL: "baseURL",
  ADDITIONAL_SCRIPTS: "additionalScripts",
}).forEach(([envVar, configKey]) => {
  if (process.env[envVar] !== undefined) {
    config[configKey] = prepareEntry(envVar, process.env[envVar]);
  }
});

// Ensure resourceFolder is set correctly
config.resourceFolder = resourceFolder;

// Log the final configuration
console.log("Final configuration:");
console.log(JSON.stringify(config, null, 2));
// Load template
console.log(`Loading template from: ${config.inputTemplate}`);
const templateContent = fs.readFileSync(config.inputTemplate, "utf8");

// Load optional content
function loadOptionalContent(filePath, defaultContent = "") {
  try {
    if (fs.existsSync(filePath)) {
      console.log(`Loading optional content from: ${filePath}`);
      return fs.readFileSync(filePath, "utf8");
    }
  } catch (error) {
    console.warn(`Warning: Failed to load ${filePath}:`, error.message);
  }
  return defaultContent;
}

// Move all config options into the config object so we can spread the whole thing
if (config.width) {
  config.additionalRevealOptions.width = config.width;
}
if (config.height) {
  config.additionalRevealOptions.height = config.height;
}

if (config.margin) {
  config.additionalRevealOptions.margin = config.margin;
}
if (config.minScale) {
  config.additionalRevealOptions.minScale = config.minScale;
}
if (config.maxScale) {
  config.additionalRevealOptions.maxScale = config.maxScale;
}

// Prepare template data
const templateData = {
  ...config,
  // Load optional HTML components
  footerHtml: "",
  bodyEndHtml: loadOptionalContent(
    `${config.resourceFolder}/body-end.html`,
    "",
  ),
  additionalScript: loadOptionalContent(
    `${config.resourceFolder}/additional.js`,
    "",
  ),
};

// Handle footer HTML (check footer, header-right, header-left in order of precedence)
if (fs.existsSync(`${config.resourceFolder}/footer.html`)) {
  templateData.footerHtml = `<div class="footer text-smaller state-background">${loadOptionalContent(`${config.resourceFolder}/footer.html`)}</div>`;
} else if (fs.existsSync(`${config.resourceFolder}/header-right.html`)) {
  templateData.footerHtml = `<div class="header-right text-smaller state-background">${loadOptionalContent(`${config.resourceFolder}/header-right.html`)}</div>`;
} else if (fs.existsSync(`${config.resourceFolder}/header-left.html`)) {
  templateData.footerHtml = `<div class="header-left text-smaller state-background">${loadOptionalContent(`${config.resourceFolder}/header-left.html`)}</div>`;
}

// Check if additional.js exists and create script tag if it does
if (templateData.additionalScript) {
  templateData.additionalScript = `<script>\n    ${templateData.additionalScript}\n</script>`;
}

// Load slides content - prioritize slides.html over markdown files
const slidesHtmlPath = `${config.resourceFolder}/slides.html`;

if (fs.existsSync(slidesHtmlPath)) {
  console.log(`Found slides.html at ${slidesHtmlPath}`);
  templateData.slidesHtml = fs.readFileSync(slidesHtmlPath, "utf8");
} else {
  console.log(
    `No slides.html found at ${slidesHtmlPath}. Looking for markdown files...`,
  );

  // Find markdown files in slides folder
  const slidesFolder = `${config.webFolder}/docs/slides`;

  try {
    if (fs.existsSync(slidesFolder)) {
      const slideFiles = fs
        .readdirSync(slidesFolder)
        .filter((file) => file.endsWith(".md"))
        .sort();

      if (slideFiles.length > 0) {
        console.log(
          `Found ${slideFiles.length} markdown files in ${slidesFolder}:`,
        );
        slideFiles.forEach((file) => console.log(` - ${file}`));

        templateData.slidesHtml = slideFiles
          .map(
            (file) =>
              `<section data-markdown="${path.join("docs/slides", file)}" data-separator-vertical="^\\r?\\n\\r?\\n\\r?\\n"></section>`,
          )
          .join("\n");
      } else {
        console.warn(`No markdown files found in ${slidesFolder}`);
        templateData.slidesHtml =
          "<section><h1>No slides found</h1><p>Please add slides.html or markdown files.</p></section>";
      }
    } else {
      console.warn(`Slides folder not found: ${slidesFolder}`);
      templateData.slidesHtml =
        "<section><h1>No slides folder found</h1><p>Please check your configuration.</p></section>";
    }
  } catch (error) {
    console.error(
      `Error reading slides folder ${slidesFolder}:`,
      error.message,
    );
    templateData.slidesHtml = `<section><h1>Error</h1><p>Failed to load slides: ${error.message}</p></section>`;
  }
}

// Render the template
try {
  console.log("Rendering template...");
  const renderedHtml = ejs.render(templateContent, templateData);

  // Write the output
  fs.writeFileSync(config.outputHtml, renderedHtml);
  console.log(`Successfully wrote rendered HTML to ${config.outputHtml}`);

  // Make it world-readable, similar to original script
  fs.chmodSync(config.outputHtml, 0o644);
} catch (error) {
  console.error("Error rendering template:", error);
  process.exit(1);
}

/**
 * Process environment variable values with special handling for complex options
 * @param {string} key - The environment variable key
 * @param {string} value - The environment variable value
 * @returns {string|number|boolean|Object} - Processed value
 */
function prepareEntry(key, value) {
  console.info(`Preparing Entry for ${key}=${value}`);
  // Return undefined for empty or undefined values
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  try {
    switch (key) {
      case "ADDITIONAL_REVEAL_OPTIONS":
        // Handle comma-separated key=value pairs and convert types
        return value.split(",").reduce((obj, pair) => {
          // Skip empty entries
          if (!pair.trim()) return obj;

          // Check if the pair contains an equals sign
          if (!pair.includes("=")) {
            console.warn(
              `Warning: Skipping invalid option format in ${key}: "${pair}". Expected format: key=value`,
            );
            return obj;
          }

          const [k, v] = pair.split("=").map((part) => part.trim());

          // Skip if key is empty
          if (!k) {
            console.warn(`Warning: Empty key in ${key}: "${pair}"`);
            return obj;
          }

          // Convert value to appropriate type
          return { ...obj, [k]: convertValueType(v) };
        }, {});

      case "ADDITIONAL_SCRIPTS":
        if (!value) return [];
        return value
          .split(",")
          .map((script) => script.trim())
          .filter((script) => script.length > 0);

      case "WIDTH":
      case "HEIGHT":
      case "MARGIN":
      case "MIN_SCALE":
      case "MAX_SCALE":
        // For specific numeric properties, convert to number if possible
        return isNumeric(value) ? Number(value) : value;

      case "SHOW_NOTES_FOR_PRINTING":
        // Convert string boolean values to actual booleans
        return convertToBoolean(value);

      default:
        // For other values, just return as is
        return value;
    }
  } catch (error) {
    console.error(`Error processing ${key}=${value}: ${error.message}`);
    return value; // Return original value on error
  }
}

/**
 * Convert a string value to appropriate type (boolean, number, or string)
 * @param {string} value - The string value to convert
 * @returns {boolean|number|string} - Converted value
 */
function convertValueType(value) {
  // Handle null/undefined
  if (value === undefined || value === null) {
    return undefined;
  }

  // Convert string to appropriate type
  const trimmedValue = String(value).trim();

  // Boolean conversion for true/false strings
  if (["true", "false"].includes(trimmedValue.toLowerCase())) {
    return trimmedValue.toLowerCase() === "true";
  }

  // Number conversion for numeric strings
  if (isNumeric(trimmedValue)) {
    return Number(trimmedValue);
  }

  // Keep as string for other values
  return trimmedValue;
}

/**
 * Check if a string value can be converted to a number
 * @param {string} value - Value to check
 * @returns {boolean} - True if the value can be converted to a number
 */
function isNumeric(value) {
  if (value === null || value === undefined || value === "") {
    return false;
  }
  return !isNaN(value) && !isNaN(parseFloat(value));
}

/**
 * Convert various string representations to boolean
 * @param {string} value - String value to convert
 * @returns {boolean} - Resulting boolean value
 */
function convertToBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === undefined || value === null) {
    return false;
  }

  const falseValues = ["false", "0", "no", "n", "off", ""];
  return !falseValues.includes(String(value).toLowerCase().trim());
}
