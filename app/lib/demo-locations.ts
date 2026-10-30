// Fictional stores clustered in New York so the map and nearby search are easy to try.
export const DEMO_LOCATIONS = [
  { id: "midtown", name: "Demo - Midtown Flagship", address: "350 5th Ave", city: "New York", state: "NY", postal_code: "10118", lat: "40.7484", lng: "-73.9857", categories: "Retail,Flagship", featured: "yes" },
  { id: "soho", name: "Demo - SoHo Studio", address: "100 Spring St", city: "New York", state: "NY", postal_code: "10012", lat: "40.7224", lng: "-73.9982", categories: "Retail,Studio" },
  { id: "chelsea", name: "Demo - Chelsea Outlet", address: "75 9th Ave", city: "New York", state: "NY", postal_code: "10011", lat: "40.7424", lng: "-74.0061", categories: "Outlet" },
  { id: "brooklyn", name: "Demo - Brooklyn Store", address: "55 Water St", city: "Brooklyn", state: "NY", postal_code: "11201", lat: "40.7033", lng: "-73.9915", categories: "Retail" },
  { id: "williamsburg", name: "Demo - Williamsburg Studio", address: "25 Kent Ave", city: "Brooklyn", state: "NY", postal_code: "11249", lat: "40.7221", lng: "-73.9595", categories: "Studio" },
].map((store): Record<string, string> => ({
  ...store,
  featured: store.featured || "no",
  country: "United States",
  description: "Fictional demo store for exploring your locator. Replace this sample with your own location.",
  phone: "+1 212 555 0100",
  email: "demo@example.com",
  hours_mon: "09:00-18:00",
  hours_tue: "09:00-18:00",
  hours_wed: "09:00-18:00",
  hours_thu: "09:00-18:00",
  hours_fri: "09:00-20:00",
  hours_sat: "10:00-18:00",
  hours_sun: "Closed",
}));
