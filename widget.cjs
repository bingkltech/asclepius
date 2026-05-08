// widget.cjs
import { fetch } from 'vite';

export async function getWidget() {
  const response = await fetch('.hermes-status.json');
  const data = await response.json();
  
  return {
    status: {
      modelName: data.modelName,
      // Add the model info here
      modelInfo: `Using Ollama Model: ${data.modelName}`,
    },
  };
}