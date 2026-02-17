import uncharted from '../eleventy.config.js';

export default function(eleventyConfig) {
  // Register the uncharted plugin with explicit dataDir for CSV files
  eleventyConfig.addPlugin(uncharted, {
    dataDir: '_data/charts',
    animate: true,
    dataPassthrough: true,
    downloadData: true,
    image: {
      enabled: true,
      outputDir: '/images/charts/',
      width: 800,
      height: 400,
      scale: 2,
      background: '#ffffff',
      stylesheets: [
        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.1/css/fontawesome.min.css',
        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.1/css/solid.min.css'
      ]
    }
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
