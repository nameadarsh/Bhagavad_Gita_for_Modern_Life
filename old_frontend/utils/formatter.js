/**
 * Formats the AI response into structured sections based on delimiters.
 * [ANSWER], [EXPLANATION], [GUIDANCE]
 */
export const formatAIResponse = (responseText) => {
  const sections = {
    answer: '',
    explanation: '',
    guidance: '',
  };

  if (!responseText) return sections;

  // Split using regex for markers
  const markers = /\[ANSWER\]|\[EXPLANATION\]|\[GUIDANCE\]/g;
  const parts = responseText.split(markers);
  const foundMarkers = responseText.match(markers);

  if (!foundMarkers) {
    // Fallback: entire text in answer section
    sections.answer = responseText.trim();
    return sections;
  }

  // First part might be empty or preamble before first marker
  let currentText = parts[0].trim();
  
  foundMarkers.forEach((marker, index) => {
    const sectionContent = parts[index + 1]?.trim() || '';
    
    if (marker === '[ANSWER]') sections.answer = sectionContent;
    if (marker === '[EXPLANATION]') sections.explanation = sectionContent;
    if (marker === '[GUIDANCE]') sections.guidance = sectionContent;
  });

  return sections;
};
