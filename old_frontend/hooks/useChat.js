import useChatStore from '../store/chatStore';
import { chatService } from '../services/chatService';
import { formatAIResponse } from '../utils/formatter';

export const useChat = () => {
  const {
    messages,
    isLoading,
    conversationId,
    addUserMessage,
    addAIMessage,
    updateStreamingMessage,
    setLoading,
    setError,
    setConversationId,
  } = useChatStore();

  const sendMessage = async (text) => {
    if (!text.trim()) return;

    addUserMessage(text);
    setLoading(true);

    const payload = {
      message: text,
      conversation_id: conversationId,
      history: messages.map(msg => ({
        role: msg.role,
        content: msg.role === 'user' ? msg.content : msg.response // adjust based on message structure
      })),
    };

    try {
      // Support both streaming and non-streaming. 
      // For now, let's implement the standard non-streaming flow first.
      const data = await chatService.sendMessage(payload);
      
      const sections = formatAIResponse(data.response);
      addAIMessage({
        sections,
        verses: data.verses,
        conversation_id: data.conversation_id,
      });

      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }
    } catch (error) {
      setError('The response could not be retrieved. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const streamMessage = async (text) => {
    if (!text.trim()) return;

    addUserMessage(text);
    setLoading(true);

    const payload = {
      message: text,
      conversation_id: conversationId,
      history: messages.map(msg => ({
        role: msg.role,
        content: msg.role === 'user' ? msg.content : msg.response
      })),
    };

    try {
      await chatService.streamMessage(payload, (delta) => {
        setLoading(false); // Typing indicator should go away when first chunk arrives
        updateStreamingMessage(delta);
      });
    } catch (error) {
      setError('The response could not be retrieved. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return {
    sendMessage,
    streamMessage,
    messages,
    isLoading,
  };
};
