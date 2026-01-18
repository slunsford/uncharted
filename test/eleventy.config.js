import uncharted from '../eleventy.config.js';

export default function(eleventyConfig) {
  // Register the uncharted plugin
  eleventyConfig.addPlugin(uncharted, {
    dataDir: '_data',
    animate: true
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
