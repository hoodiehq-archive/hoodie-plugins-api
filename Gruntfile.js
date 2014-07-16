module.exports = function (grunt) {
  grunt.loadNpmTasks('grunt-release-hoodie');

  grunt.initConfig({
    release: {
      options: {
        bump: {
          files: ['package.json'],
          commitFiles: ['package.json', 'CHANGELOG.md']
        },
        tasks: ['changelog']
      }
    }
  });
};
