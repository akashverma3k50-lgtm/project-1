export interface SiteContent {
  brand: {
    name: string;
    tagline: string;
    logoText: string;
    email: string;
    phone: string;
    location: string;
    businessHours: string;
  };
  seo: {
    defaultTitle: string;
    defaultDescription: string;
    siteUrl: string;
    ogImage: string;
    twitterHandle: string;
  };
  home: {
    hero: {
      badge: string;
      heading: string;
      subheading: string;
      primaryCta: { text: string; link: string };
      secondaryCta: { text: string; link: string };
    };
    valueProposition: {
      title: string;
      subtitle: string;
      pillars: Array<{
        icon: string;
        title: string;
        description: string;
      }>;
    };
    overview: {
      title: string;
      body: string;
      stats: Array<{ value: string; label: string }>;
    };
    testimonials: Array<{
      quote: string;
      author: string;
      role: string;
    }>;
    ctaBanner: {
      title: string;
      subtitle: string;
      buttonText: string;
      buttonLink: string;
    };
  };
  services: {
    header: {
      badge: string;
      title: string;
      subtitle: string;
    };
    items: Array<{
      id: string;
      icon: string;
      title: string;
      summary: string;
      details: string;
      deliverables: string[];
      badge?: string;
      image?: string;
    }>;
    process: Array<{
      step: string;
      title: string;
      description: string;
    }>;
  };
  contact: {
    header: {
      badge: string;
      title: string;
      subtitle: string;
    };
    info: {
      addressTitle: string;
      address: string;
      emailTitle: string;
      email: string;
      phoneTitle: string;
      phone: string;
      hoursTitle: string;
      hours: string;
    };
    form: {
      nameLabel: string;
      namePlaceholder: string;
      emailLabel: string;
      emailPlaceholder: string;
      subjectLabel: string;
      subjectPlaceholder: string;
      subjectOptions?: string[];
      messageLabel: string;
      messagePlaceholder: string;
      submitButtonText: string;
      successMessage: string;
      errorMessage: string;
    };
  };
}

export interface ContactSubmissionRecord {
  id?: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  ip_address: string;
  user_agent: string;
  created_at?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Array<{ field?: string; message: string }>;
}
