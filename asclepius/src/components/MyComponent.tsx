import React from 'react';
import { getContactInfo } from '../services/api';

const MyComponent = () => {
  const url = 'https://example.com'; // Replace with actual URL
  const contactInfo = getContactInfo(url);

  return (
    <div>
      {contactInfo && (
        <ul>
          <li>Email: {contactInfo.email}</li>
          <li>Phone Number: {contactInfo.phoneNumber}</li>
        </ul>
      )}
    </div>
  );
};

export default MyComponent;