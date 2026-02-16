import uncharted from '../eleventy.config.js';

export default function(eleventyConfig) {
  // Register the uncharted plugin with explicit dataDir for CSV files
  eleventyConfig.addPlugin(uncharted, {
    dataDir: '_data/charts',
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
