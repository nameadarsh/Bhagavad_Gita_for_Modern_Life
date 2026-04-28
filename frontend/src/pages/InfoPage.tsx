const pipelineSteps = ['User', 'RAG', 'LLM', 'TTS', 'Audio'];

const InfoPage = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <section className="bg-white border border-orange-100 rounded-2xl p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-800">How your query is processed</h1>
        <p className="text-slate-600 mt-2">
          Each question moves through a simple pipeline before the response is shown and spoken.
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-6">
          {pipelineSteps.map((step, index) => (
            <div key={step} className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-orange-50 border border-orange-200 text-sm font-semibold text-orange-700">
                {step}
              </div>
              {index < pipelineSteps.length - 1 && <span className="text-slate-400">→</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="bg-white border border-orange-100 rounded-2xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Retrieval</h2>
          <p className="text-sm text-slate-600 mt-2">
            The system finds the most relevant verses and context from the indexed Bhagavad Gita data.
          </p>
        </div>
        <div className="bg-white border border-orange-100 rounded-2xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Reasoning</h2>
          <p className="text-sm text-slate-600 mt-2">
            The language model uses the retrieved verse, chapter context, and your query to shape the answer.
          </p>
        </div>
        <div className="bg-white border border-orange-100 rounded-2xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Response Generation</h2>
          <p className="text-sm text-slate-600 mt-2">
            The final text response is streamed to chat, and audio can be produced through the existing speech flow.
          </p>
        </div>
      </section>

      <section className="bg-white border border-orange-100 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-800">Was this helpful?</h2>
        <p className="text-sm text-slate-600 mt-2">
          Feedback storage is not connected yet, but the UI is ready for a future backend integration.
        </p>
        <div className="flex flex-wrap gap-3 mt-4">
          <button type="button" className="px-4 py-2 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors">
            Yes
          </button>
          <button type="button" className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors">
            No
          </button>
        </div>
      </section>
    </div>
  );
};

export default InfoPage;
