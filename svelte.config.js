import adapter from '@sveltejs/adapter-static';

const githubPages = process.env.GITHUB_PAGES === 'true';

export default {
  kit: {
    paths: {
      base: githubPages ? '/cesky' : ''
    },
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: '200.html',
      precompress: false,
      strict: true
    })
  }
};
