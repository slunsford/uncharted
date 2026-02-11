import uncharted from '../eleventy.config.js';

export default function(eleventyConfig) {
  // Register the uncharted plugin (dataDir auto-detected from Eleventy config)
  eleventyConfig.addPlugin(uncharted, {
    animate: true,
    dataPassthrough: true,
    downloadData: true
  });

  return {
    dir: {
      input: '.',
      output: '_site',
      data: '_data'
    },
    markdownTemplateEngine: 'njk'
  };
}
