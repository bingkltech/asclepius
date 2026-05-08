import axios from 'axios';

const api = axios.create({
  baseURL: 'https://apify.com/dainty_screw/social-media-and-contact-info-extractor?fpr=p2hrc6',
});

async function getContactInfo(url: string) {
  try {
    const response = await api.get(`?url=${encodeURIComponent(url)}`);
    return response.data;
  } catch (error) {
    console.error(error);
    // Implement fallback strategy here
  }
}

export { getContactInfo };