import { chromium, Browser, Page } from 'playwright';
import { DiscoveredPage, FormInfo, FormField, InputInfo } from '../types/Config';
import { logger } from './Logger';

interface CrawlReport {
  totalPages: number;
  loginPages: number;
  formsFound: number;
  searchBars: number;
  tablesFound: number;
  navigationItems: number;
}

export class WebsiteCrawler {
  private visitedUrls: Set<string> = new Set();
  private pages: DiscoveredPage[] = [];
  private maxDepth: number = 2;
  private maxPages: number = 30;
  private baseUrl: string = '';
  private browser?: Browser;
  private page?: Page;
  private isHeadless: boolean = true;
  private sharedPage?: Page;

  private report: CrawlReport = {
    totalPages: 0,
    loginPages: 0,
    formsFound: 0,
    searchBars: 0,
    tablesFound: 0,
    navigationItems: 0
  };

  async crawl(url: string, headless: boolean = true, sharedPage?: Page): Promise<DiscoveredPage[]> {
    try {
      this.baseUrl = new URL(url).origin;
      this.visitedUrls.clear();
      this.pages = [];
      this.isHeadless = headless;
      this.sharedPage = sharedPage;

      if (sharedPage) {
        // Use shared browser page
        this.page = sharedPage;
        logger.info(`Starting crawl using shared page from: ${url}`);
        
        try {
          await this.page.goto(url, { timeout: 20000, waitUntil: 'networkidle' });
          // Wait for React/Vite to render
          await this.page.waitForTimeout(3000);
        } catch (error: any) {
          logger.warn(`Navigation error: ${error.message}, trying domcontentloaded...`);
          try {
            await this.page.goto(url, { timeout: 15000, waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(3000);
          } catch (e: any) {
            logger.warn(`Second navigation failed: ${e.message}`);
          }
        }
        
        // Wait for body to be ready
        try {
          await this.page.waitForSelector('body', { timeout: 5000 });
        } catch {}
        
        const page = await this.analyzeCurrentPage(url);
        this.pages.push(page);
        this.report.totalPages++;
        if (page.hasLogin) this.report.loginPages++;
        this.report.formsFound += page.forms.length;
        this.report.tablesFound += page.tables;

        // Crawl links
        await this.crawlLinksFromCurrentPage(0);
        
        return this.pages;
      } else {
        // Initialize own browser
        this.browser = await chromium.launch({ 
          headless: this.isHeadless,
          executablePath: process.platform === 'darwin' 
            ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            : undefined
        });
        this.page = await this.browser.newPage();
        
        logger.info(`Starting crawl from: ${url}`);
        
        await this.crawlPage(url, 0);

        logger.success(`Crawled ${this.pages.length} pages`);
        
        return this.pages;
      }
    } catch (error: any) {
      logger.error(`Crawl failed: ${error.message}`);
      return this.pages;
    } finally {
      if (this.browser && !this.sharedPage) {
        await this.browser.close();
      }
    }
  }

  /**
   * Crawl additional pages while authenticated (after login)
   */
  async crawlAuthenticatedPages(authenticatedPage: Page, baseUrl: string): Promise<DiscoveredPage[]> {
    const authPages: DiscoveredPage[] = [];
    
    try {
      this.baseUrl = new URL(baseUrl).origin;
      this.page = authenticatedPage;
      
      logger.info('Crawling authenticated pages...');

      // Get current URL and analyze it
      const currentUrl = authenticatedPage.url();
      if (!this.visitedUrls.has(currentUrl)) {
        this.visitedUrls.add(currentUrl);
        this.page = authenticatedPage;
        const page = await this.analyzeCurrentPage(currentUrl);
        authPages.push(page);
      }

      // Try to find navigation links
      const content = await authenticatedPage.content();
      const cheerio = await import('cheerio');
      const $ = cheerio.load(content);
      
      const navLinks = this.extractLinks($, currentUrl);
      logger.info(`Found ${navLinks.length} navigation links`);
      
      // Visit key authenticated pages
      const keyPaths = ['/dashboard', '/home', '/profile', '/appointments', '/patients', '/doctors', '/settings'];
      
      for (const path of keyPaths) {
        try {
          const fullUrl = this.baseUrl + path;
          if (!this.visitedUrls.has(fullUrl) && authPages.length < 10) {
            logger.info(`Visiting: ${fullUrl}`);
            await authenticatedPage.goto(fullUrl, { timeout: 10000, waitUntil: 'networkidle' });
            await authenticatedPage.waitForTimeout(500);
            
            const url = authenticatedPage.url();
            if (!this.visitedUrls.has(url)) {
              this.visitedUrls.add(url);
              const page = await this.analyzeCurrentPage(url);
              authPages.push(page);
            }
          }
        } catch (error: any) {
          logger.warn(`Failed to visit ${path}: ${error.message}`);
        }
      }

      logger.success(`Crawled ${authPages.length} authenticated pages`);
    } catch (error: any) {
      logger.error(`Authenticated crawl failed: ${error.message}`);
    }
    
    return authPages;
  }

  private async crawlLinksFromCurrentPage(depth: number): Promise<void> {
    if (depth >= this.maxDepth || this.pages.length >= this.maxPages) {
      return;
    }

    try {
      await this.page!.waitForTimeout(1000);

      const currentUrl = this.page!.url();
      const content = await this.page!.content().catch(() => '<html></html>');
      const cheerio = await import('cheerio');
      const $ = cheerio.load(content);
      
      const links = this.extractLinks($, currentUrl);
      logger.info(`Found ${links.length} links on ${currentUrl}`);
      
      for (const link of links.slice(0, 10)) {
        if (this.visitedUrls.has(link) || this.pages.length >= this.maxPages) {
          continue;
        }
        
        try {
          await this.page!.goto(link, { timeout: 10000, waitUntil: 'domcontentloaded' });
          await this.page!.waitForTimeout(1000);
          
          const newUrl = this.page!.url();
          if (!this.visitedUrls.has(newUrl)) {
            this.visitedUrls.add(newUrl);
            const page = await this.analyzeCurrentPage(newUrl);
            this.pages.push(page);
            this.report.totalPages++;
            if (page.hasLogin) this.report.loginPages++;
            this.report.formsFound += page.forms.length;
            this.report.tablesFound += page.tables;
            
            // Recursively crawl links on this page
            await this.crawlLinksFromCurrentPage(depth + 1);
          }
        } catch (error: any) {
          logger.warn(`Failed to crawl: ${link} - ${error.message}`);
        }
        
        await this.page!.waitForTimeout(300);
      }
    } catch (error: any) {
      logger.warn(`Failed to extract links: ${error.message}`);
    }
  }

  private async analyzeCurrentPage(url: string): Promise<DiscoveredPage> {
    try {
      // Wait for page to be ready
      await this.page!.waitForLoadState('domcontentloaded').catch(() => {});
      await this.page!.waitForTimeout(500);

      const [formData, inputData, buttonData, pageTitle, isLoginPage, tableCount] = await Promise.all([
        this.page!.evaluate(() => {
          const forms: any[] = [];
          document.querySelectorAll('form').forEach((form: any) => {
            const fields: any[] = [];
            form.querySelectorAll('input, select, textarea').forEach((input: any) => {
              fields.push({
                name: input.name || '',
                type: input.type || 'text',
                required: input.required || false,
                id: input.id || '',
                placeholder: input.placeholder || ''
              });
            });
            forms.push({
              action: form.action || '',
              method: form.method || 'get',
              fields
            });
          });
          return forms;
        }),
        this.page!.evaluate(() => {
          const inputs: any[] = [];
          document.querySelectorAll('input, select, textarea').forEach((input: any) => {
            inputs.push({
              type: input.type || 'text',
              name: input.name || '',
              id: input.id || '',
              placeholder: input.placeholder || ''
            });
          });
          return inputs;
        }),
        this.page!.evaluate(() => {
          const buttons: string[] = [];
          document.querySelectorAll('button').forEach((btn: any) => {
            buttons.push(btn.textContent?.trim() || btn.type || 'button');
          });
          return buttons;
        }),
        this.page!.evaluate(() => document.title),
        this.page!.evaluate(() => {
          const text = document.body.textContent?.toLowerCase() || '';
          const loginKeywords = ['login', 'signin', 'sign-in', 'log-in', 'đăng nhập', 'đăng ký'];
          const hasKeyword = loginKeywords.some((k: string) => text.includes(k));
          const hasPassword = document.querySelector('input[type="password"]') !== null;
          return hasKeyword || hasPassword;
        }),
        this.page!.evaluate(() => document.querySelectorAll('table').length)
      ]);

      return {
        url,
        title: pageTitle || '',
        forms: formData || [],
        inputs: inputData || [],
        buttons: buttonData || [],
        links: [],
        tables: tableCount || 0,
        hasLogin: isLoginPage || false,
        depth: 0
      };
    } catch (error: any) {
      logger.warn(`Failed to analyze page ${url}: ${error.message}`);
      return {
        url,
        title: '',
        forms: [],
        inputs: [],
        buttons: [],
        links: [],
        tables: 0,
        hasLogin: false,
        depth: 0
      };
    }
  }

  private async crawlPage(url: string, depth: number): Promise<void> {
    if (depth > this.maxDepth || this.visitedUrls.has(url) || this.pages.length >= this.maxPages) {
      return;
    }

    this.visitedUrls.add(url);

    try {
      // Use Playwright to navigate (executes JavaScript)
      await this.page!.goto(url, { 
        timeout: 15000,
        waitUntil: 'networkidle'
      });

      // Wait for React/Vite to render
      await this.page!.waitForTimeout(1000);

      // Get page content after JavaScript execution
      const content = await this.page!.content();
      
      // Parse with cheerio for analysis
      const cheerio = await import('cheerio');
      const $ = cheerio.load(content);
      
      const page = this.analyzePage($, url);
      this.pages.push(page);

      this.report.totalPages++;
      if (page.hasLogin) this.report.loginPages++;
      this.report.formsFound += page.forms.length;
      this.report.tablesFound += page.tables;

      if (depth < this.maxDepth) {
        const links = this.extractLinks($, url);
        logger.info(`Found ${links.length} links on ${url}`);
        
        // Crawl links with delay to avoid overwhelming server
        for (const link of links.slice(0, 10)) {
          await this.crawlPage(link, depth + 1);
          await this.page!.waitForTimeout(500); // Rate limiting
        }
      }

    } catch (error: any) {
      logger.warn(`Failed to crawl: ${url} - ${error.message}`);
    }
  }

  private analyzePage($: any, url: string): DiscoveredPage {
    const title = $('title').text().trim();
    const forms: FormInfo[] = [];
    const inputs: InputInfo[] = [];
    const buttons: string[] = [];
    const links: string[] = [];

    $('form').each((_: number, el: any) => {
      const form: FormInfo = {
        action: $(el).attr('action') || '',
        method: $(el).attr('method') || 'get',
        fields: []
      };

      $(el).find('input, select, textarea').each((_: number, input: any) => {
        const field: FormField = {
          name: $(input).attr('name') || '',
          type: $(input).attr('type') || 'text',
          required: $(input).attr('required') !== undefined
        };
        form.fields.push(field);

        inputs.push({
          type: field.type,
          name: field.name,
          id: $(input).attr('id'),
          placeholder: $(input).attr('placeholder')
        });
      });

      forms.push(form);
    });

    $('button').each((_: number, el: any) => {
      const text = $(el).text().trim() || $(el).attr('type') || 'button';
      buttons.push(text);
    });

    const hasLogin = this.checkForLoginForm($);
    const tables = $('table').length;

    return {
      url,
      title,
      forms,
      inputs,
      buttons,
      links,
      tables,
      hasLogin,
      depth: 0
    };
  }

  private checkForLoginForm($: any): boolean {
    const loginKeywords = ['login', 'signin', 'sign-in', 'log-in', 'authenticate', 'đăng nhập', 'đăng ký'];
    const pageText = $('body').text().toLowerCase();
    const hasKeyword = loginKeywords.some(keyword => pageText.includes(keyword));
    
    const hasPasswordField = $('input[type="password"]').length > 0;
    
    return hasKeyword || hasPasswordField;
  }

  private extractLinks($: any, currentUrl: string): string[] {
    const links: string[] = [];
    const baseUrlObj = new URL(currentUrl);

    $('a[href]').each((_: number, el: any) => {
      const href = $(el).attr('href');
      if (href) {
        try {
          const absoluteUrl = new URL(href, baseUrlObj.href).href;
          const urlObj = new URL(absoluteUrl);
          
          // Only same-origin links
          if (urlObj.origin === this.baseUrl && !this.visitedUrls.has(absoluteUrl)) {
            links.push(absoluteUrl);
          }
        } catch {}
      }
    });

    // Also get links from navigation
    const navLinks = $('nav a[href], header a[href], .nav a[href], [role="navigation"] a[href]');
    this.report.navigationItems += navLinks.length;

    // Get links from React Router (common patterns)
    const routeLinks = $('[class*="router"], [class*="nav"], [class*="menu"] a[href]');
    routeLinks.each((_: number, el: any) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('/')) {
        const fullUrl = this.baseUrl + href;
        if (!this.visitedUrls.has(fullUrl)) {
          links.push(fullUrl);
        }
      }
    });

    return [...new Set(links)].slice(0, 15);
  }

  getReport(): CrawlReport {
    return { ...this.report };
  }

  getDiscoveredPages(): DiscoveredPage[] {
    return [...this.pages];
  }
}

export const websiteCrawler = new WebsiteCrawler();
