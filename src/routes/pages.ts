import { Router, type Request, type Response } from 'express';
import { getSiteContent } from '../services/contentService.js';

export const pagesRouter = Router();

/**
 * GET /
 * Home page: Clear value statement, hero section, trust indicators, overview
 */
pagesRouter.get('/', (_req: Request, res: Response) => {
  const content = getSiteContent();
  res.render('home', {
    title: `${content.brand.name} | ${content.home.hero.badge}`,
    description: content.seo.defaultDescription,
    activePage: 'home',
    content,
  });
});

/**
 * GET /services
 * Services page: Separate sections for each offering with concise descriptions
 */
pagesRouter.get('/services', (_req: Request, res: Response) => {
  const content = getSiteContent();
  res.render('services', {
    title: `Our Services | ${content.brand.name}`,
    description: content.services.header.subtitle,
    activePage: 'services',
    content,
  });
});

/**
 * GET /contact
 * Contact page: Straightforward form with CSRF token and spam protection
 */
pagesRouter.get('/contact', (_req: Request, res: Response) => {
  const content = getSiteContent();
  res.render('contact', {
    title: `Contact Us | ${content.brand.name}`,
    description: content.contact.header.subtitle,
    activePage: 'contact',
    content,
    csrfToken: res.locals.csrfToken,
    formTimestamp: Date.now(),
  });
});
