import React, { useState } from 'react';
import { ChevronDown, Star, Globe, FileText, Send, User, BookOpen, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { chatApi } from '../services/api';

// ─── Accordion Tile ───────────────────────────────────────────────────────────

interface AccordionTileProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const AccordionTile: React.FC<AccordionTileProps> = ({ title, isOpen, onToggle, children }) => (
  <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden transition-all duration-200 hover:shadow-lg">
    <button
      onClick={onToggle}
      className="w-full px-6 py-6 flex justify-between items-center text-left hover:bg-slate-50 transition-colors"
    >
      <span className="text-xl font-bold text-slate-800">{title}</span>
      <ChevronDown className={`w-6 h-6 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    {isOpen && (
      <div className="px-8 pb-8 border-t border-slate-100 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
        {children}
      </div>
    )}
  </div>
);

// ─── Box ─────────────────────────────────────────────────────────────────

interface BoxProps {
  title: string;
  children: React.ReactNode;
  color: string;
}

const Box: React.FC<BoxProps> = ({ title, children, color }) => (
  <div className={`${color} rounded-2xl p-5 shadow-sm border border-orange-100 text-center hover:shadow-md transition-shadow`}>
    <h4 className="font-bold text-slate-800 text-base mb-2">{title}</h4>
    <div className="text-sm text-slate-600 leading-relaxed">{children}</div>
  </div>
);

export default function InfoPage() {
  const [open, setOpen] = useState(0);
  
  // Feedback States
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [name, setName] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const toggleTile = (index: number) => {
    setOpen(open === index ? -1 : index);
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (rating === 0) {
      setErrorMessage("Please select a rating before submitting.");
      setSubmitStatus('error');
      return;
    }

    if (feedback.length > 500) {
      setErrorMessage("Feedback is too long (max 500 characters).");
      setSubmitStatus('error');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      await chatApi.submitFeedback(rating, name, feedback);
      setSubmitStatus('success');
      setRating(0);
      setName('');
      setFeedback('');
    } catch (err: any) {
      setSubmitStatus('error');
      setErrorMessage(err.message || "Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-orange-50/30">
      <div className="max-w-5xl w-full mx-auto py-16 space-y-8">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl font-extrabold text-slate-800">Information & Guidance</h1>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto">Learn how Clarity works and how to get the most out of your sessions.</p>
        </div>

        {/* HOW IT WORKS */}
        <AccordionTile title="How it Works" isOpen={open === 0} onToggle={() => toggleTile(0)}>
          <p className="text-slate-600 text-lg leading-relaxed">
            Your question goes through multiple steps to ensure the response is relevant and meaningful.
          </p>

          {/* FLOW */}
          <div className="space-y-12 py-4">
            {/* LABELS */}
            <div className="hidden md:grid grid-cols-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-400 text-center">
              <span>Frontend</span>
              <span>Backend</span>
              <span>AI / Tools</span>
            </div>

            {/* DESKTOP FLOW */}
            <div className="hidden md:grid grid-cols-3 gap-8 items-start">
              {/* FRONTEND */}
              <div className="space-y-24">
                <Box title="User Input" color="bg-orange-50/50">
                  Query + Language Selection
                </Box>
                <Box title="User Output" color="bg-orange-50/50">
                  Text + Audio Response
                </Box>
              </div>

              {/* BACKEND */}
              <div className="space-y-8">
                <Box title="Query Processing" color="bg-white">
                  Prepare for retrieval
                </Box>
                <Box title="Knowledge Retrieval" color="bg-white">
                  • Search Gita knowledge base<br />
                  • Retrieve top relevant shlokas<br />
                  • Re-rank best matches
                </Box>
                <Box title="Response Handling" color="bg-white">
                  Sends response + audio to frontend
                </Box>
              </div>

              {/* AI */}
              <div className="space-y-8">
                <Box title="Small LLM" color="bg-orange-50/30">
                  Refines query<br />
                  Extracts intent
                </Box>
                <Box title="Main LLM" color="bg-orange-50/30">
                  Uses shlokas + query<br />
                  Generates answer
                </Box>
                <Box title="TTS API" color="bg-orange-50/30">
                  Converts text to speech<br />
                  Multi-language output
                </Box>
              </div>
            </div>

            {/* MOBILE FLOW */}
            <div className="md:hidden space-y-6">
              <Box title="User Input" color="bg-orange-50/50">Query + Language</Box>
              <Box title="Query Processing" color="bg-white">Prepare query</Box>
              <Box title="Small LLM" color="bg-orange-50/30">Refines intent</Box>
              <Box title="Knowledge Retrieval" color="bg-white">Retrieve shlokas</Box>
              <Box title="Main LLM" color="bg-orange-50/30">Generate answer</Box>
              <Box title="TTS API" color="bg-orange-50/30">Convert to speech</Box>
              <Box title="User Output" color="bg-orange-50/50">Text + Audio</Box>
            </div>
          </div>

          {/* TECH STACK */}
          <div className="pt-8 border-t border-orange-100 space-y-6">
            <h4 className="text-xl font-bold text-slate-800">System Architecture</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">Training</p>
                <p className="text-slate-700">Sentence Transformers, Embeddings, FAISS, Bhagavad Gita corpus</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">Backend</p>
                <p className="text-slate-700">Python, FastAPI, Groq LLM, Ollama (Mistral), Sarvam TTS API</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">Frontend</p>
                <p className="text-slate-700">React, Tailwind CSS, Lucide Icons</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">Deployment</p>
                <p className="text-slate-700">Optimized lightweight backend (512MB RAM, 0.1 CPU)</p>
              </div>
            </div>
          </div>
        </AccordionTile>

        {/* OTHER TILES */}
        <AccordionTile title="Using the App Effectively" isOpen={open === 1} onToggle={() => toggleTile(1)}>
          <ul className="space-y-4">
            {[
              'Ask about a specific situation you’re facing',
              'Keep your question clear and focused',
              'Use your preferred language for better comfort'
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-4 text-slate-700 text-lg">
                <div className="h-2 w-2 rounded-full bg-orange-500" />
                {item}
              </li>
            ))}
          </ul>
          <p className="pt-4 text-slate-600 italic text-lg border-t border-orange-50">
            "This tool provides guidance based on the Bhagavad Gita to help you reflect and think clearly."
          </p>
        </AccordionTile>

        <AccordionTile title="Feedback" isOpen={open === 2} onToggle={() => toggleTile(2)}>
          <div className="space-y-8">
            <p className="text-slate-600 text-lg leading-relaxed">
              We value your thoughts. Your feedback helps us improve the guidance experience for everyone.
            </p>

            {submitStatus === 'success' ? (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-8 text-center space-y-3 animate-in fade-in zoom-in duration-300">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h4 className="text-xl font-bold text-slate-800">Thanks for your feedback!</h4>
                <p className="text-slate-600">Your contribution helps make Clarity better for everyone.</p>
                <button 
                  onClick={() => setSubmitStatus('idle')}
                  className="mt-4 text-indigo-600 font-bold hover:underline"
                >
                  Submit another response
                </button>
              </div>
            ) : (
              <form onSubmit={handleFeedbackSubmit} className="space-y-6">
                {/* RATING */}
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    Rating <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-col space-y-2">
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className={`w-10 h-10 cursor-pointer transition-all duration-200 ${
                            (hoverRating || rating) >= i 
                              ? 'fill-amber-400 text-amber-400 scale-110' 
                              : 'text-slate-200'
                          } hover:scale-110 active:scale-95`}
                          onMouseEnter={() => setHoverRating(i)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setRating(i)}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between max-w-[210px] text-[10px] text-slate-400 font-bold uppercase tracking-widest px-1">
                      <span>Poor</span>
                      <span>Excellent</span>
                    </div>
                  </div>
                </div>

                {/* NAME & FEEDBACK */}
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                      Name <span className="text-slate-400 font-normal lowercase">(optional)</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all disabled:opacity-50"
                      placeholder="How should we call you?"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="feedback-text" className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                      Feedback <span className="text-slate-400 font-normal lowercase">(optional)</span>
                    </label>
                    <textarea
                      id="feedback-text"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full p-4 bg-slate-50 border border-orange-100 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all resize-none disabled:opacity-50"
                      placeholder="What's on your mind? Suggestions, bugs, or what you liked..."
                      rows={4}
                    />
                  </div>
                </div>

                {/* ERROR MESSAGE */}
                {submitStatus === 'error' && (
                  <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle size={20} className="flex-shrink-0" />
                    <p className="text-sm font-medium">{errorMessage}</p>
                  </div>
                )}

                {/* SUBMIT BUTTON */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full md:w-auto bg-orange-600 text-white px-12 py-4 rounded-2xl font-extrabold text-lg hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit Feedback
                      <Send size={20} />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </AccordionTile>

        <AccordionTile title="About the Developer" isOpen={open === 3} onToggle={() => toggleTile(3)}>
          <div className="space-y-6">
            <p className="text-slate-600 text-lg leading-relaxed">
              Created with a passion for combining modern AI with timeless wisdom to help people navigate life's challenges.
            </p>
            <div className="flex flex-wrap gap-4">
              <button className="flex-1 min-w-[160px] bg-[#0077B5] text-white py-4 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-all font-bold shadow-sm">
                <Globe size={20} /> LinkedIn
              </button>
              <button className="flex-1 min-w-[160px] bg-slate-800 text-white py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-700 transition-all font-bold shadow-sm">
                <User size={20} /> Portfolio
              </button>
              <button className="flex-1 min-w-[160px] bg-white border border-orange-200 text-slate-700 py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-orange-50 transition-all font-bold shadow-sm">
                <FileText size={20} /> View CV
              </button>
            </div>
          </div>
        </AccordionTile>
      </div>
    </div>
  );
}
