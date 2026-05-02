export const REGULATORY_SOURCE_SEEDS = [
  {
    title: "Waste duty of care code of practice",
    url: "https://www.gov.uk/government/publications/waste-duty-of-care-code-of-practice",
    source_type: "guidance",
    category: "duty_of_care"
  },
  {
    title: "Dispose of business or commercial waste",
    url: "https://www.gov.uk/dispose-business-commercial-waste",
    source_type: "guidance",
    category: "business_waste"
  },
  {
    title: "Waste transfer notes",
    url: "https://www.gov.uk/dispose-business-commercial-waste/waste-transfer-notes",
    source_type: "guidance",
    category: "waste_transfer_notes"
  },
  {
    title: "Duty of care waste transfer note template",
    url: "https://www.gov.uk/government/publications/duty-of-care-waste-transfer-note-template",
    source_type: "template",
    category: "waste_transfer_notes"
  },
  {
    title: "Simpler recycling: workplace recycling in England",
    url: "https://www.gov.uk/guidance/simpler-recycling-workplace-recycling-in-england",
    source_type: "guidance",
    category: "recycling"
  },
  {
    title: "Search waste carriers, brokers and dealers register",
    url: "https://environment.data.gov.uk/public-register/view/search-waste-carriers-brokers",
    source_type: "register",
    category: "carrier_register"
  },
  {
    title: "Digital waste tracking service",
    url: "https://www.gov.uk/guidance/digital-waste-tracking",
    source_type: "guidance",
    category: "digital_tracking"
  }
] as const;

export const ALLOWED_REGULATORY_DOMAINS = ["gov.uk", "environment.data.gov.uk", "environmentagency.blog.gov.uk"];
