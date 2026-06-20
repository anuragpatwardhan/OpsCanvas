import type { Project } from "./types";

export const projects: Project[] = [
  {
    id: "p_checkout",
    name: "Checkout Platform",
    jiraKey: "CHK",
    githubRepo: "acme/checkout",
    slackChannel: "#checkout-eng",
    owner: "Priya Shah",
  },
  {
    id: "p_billing",
    name: "Billing Service",
    jiraKey: "BILL",
    githubRepo: "acme/billing",
    slackChannel: "#billing-eng",
    owner: "Marcus Lee",
  },
  {
    id: "p_identity",
    name: "Identity & Auth",
    jiraKey: "AUTH",
    githubRepo: "acme/identity",
    slackChannel: "#identity-eng",
    owner: "Sara Okafor",
  },
  {
    id: "p_search",
    name: "Search Infra",
    jiraKey: "SRCH",
    githubRepo: "acme/search",
    slackChannel: "#search-eng",
    owner: "Diego Romero",
  },
  {
    id: "p_mobile",
    name: "Mobile App",
    jiraKey: "MOB",
    githubRepo: "acme/mobile",
    slackChannel: "#mobile-eng",
    owner: "Hannah Cole",
  },
  {
    id: "p_data",
    name: "Data Platform",
    jiraKey: "DATA",
    githubRepo: "acme/data-platform",
    slackChannel: "#data-eng",
    owner: "Aarav Mehta",
  },
];
