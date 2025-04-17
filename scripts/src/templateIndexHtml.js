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
}).forEach(([envVar, configKey]) => {
  if (process.env[envVar] !== undefined) {
    config[configKey] = process.env[envVar];
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

// Prepare template data
const templateData = {
  title: config.title,
  themeCss: config.themeCss,
  additionalPlugins: config.additionalPlugins,
  additionalRevealOptions: config.additionalRevealOptions,
  showNotesForPrinting: config.showNotesForPrinting,
  width: config.width,
  height: config.height,
  margin: config.margin,
  minScale: config.minScale,
  maxScale: config.maxScale,

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
