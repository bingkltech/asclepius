import { useState } from 'react';

interface WidgetStatus {
  ollamaModel: string;
}

const Widget = () => {
  const [status, setStatus] = useState({
    ollamaModel: 'asclepius',
  });

  return (
    <div>
      <p>Ollama Model: {status.ollamaModel}</p>
    </div>
  );
};

export default Widget;