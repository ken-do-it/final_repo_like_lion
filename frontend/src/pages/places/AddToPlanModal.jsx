import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import plansService from '../../api/plansApi'; // Adjust path as needed
import { useLanguage } from '../../context/LanguageContext';

const AddToPlanModal = ({ place, onClose }) => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                // Fetch all plans. You might want to filter active ones in backend or here.
                const response = await plansService.plans.getPlans();
                // Filter: end_date is in the future (or today)
                const now = new Date();
                now.setHours(0, 0, 0, 0);

                const activePlans = response.data.filter(p => {
                    const end = new Date(p.end_date);
                    return end >= now;
                });

                // Sort by start_date ascending
                activePlans.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
                setPlans(activePlans);
            } catch (err) {
                console.error("Failed to fetch plans", err);
            } finally {
                setLoading(false);
            }
        };
        fetchPlans();
    }, []);

    const handlePlanSelect = (plan) => {
        setSelectedPlan(plan);
        setSelectedDate(null); // Reset date when plan changes
    };

    const handleDateSelect = (date) => {
        setSelectedDate(date);
    };

    const handleAddToPlan = async () => {
        if (!selectedPlan || !selectedDate) return;

        setSubmitting(true);
        try {
            const payload = {
                plan_id: selectedPlan.id,
                date: selectedDate, // YYYY-MM-DD
                place_name: place.name,
                place_id: place.id, // If it exists
                api_id: place.api_id || place.place_api_id, // If from API
                address: place.address,
                latitude: place.latitude,
                longitude: place.longitude,
                category: place.category,
                thumbnail_url: place.thumbnail_urls?.[0] || place.thumbnail_url
            };

            await plansService.details.addPlaceToplan(selectedPlan.id, payload);

            // Navigate to plan detail
            onClose();
            navigate(`/plans/${selectedPlan.id}`);
        } catch (err) {
            console.error("Failed to add place to plan:", err);
            alert(t('msg_add_failed') || "일정 추가에 실패했습니다.");
        } finally {
            setSubmitting(false);
        }
    };

    const getDaysArray = (start, end) => {
        const arr = [];
        const dt = new Date(start);
        const endDt = new Date(end);
        let dayCount = 1;
        while (dt <= endDt) {
            arr.push({
                date: new Date(dt).toISOString().split('T')[0],
                label: `Day ${dayCount}`,
                dayName: new Date(dt).toLocaleDateString('ko-KR', { weekday: 'short' }), // e.g., '금'
                fullDate: new Date(dt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) // e.g., '2.6'
            });
            dt.setDate(dt.getDate() + 1);
            dayCount++;
        }
        return arr;
    };

    if (!place) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-[#1e2b36] w-full md:w-[480px] md:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up md:animate-scale-in">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
                    <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <span className="text-xl">✕</span>
                    </button>
                    <h2 className="text-lg font-bold dark:text-white">{t('title_add_schedule') || "일정 등록"}</h2>
                    <button
                        onClick={() => navigate('/plans/create')}
                        className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-[#1392ec] text-sm font-bold rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    >
                        {t('btn_new_plan') || "+ 새 일정"}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 scrollbar-hide">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1392ec]"></div>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Selected Plan Section */}
                            {selectedPlan && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400">
                                        {t('label_current_trip') || "현재 여행"}
                                    </h3>
                                    <div className="bg-gray-50 dark:bg-[#0f1921] rounded-xl p-4 border border-blue-100 dark:border-blue-900/30">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden shrink-0">
                                                {selectedPlan.thumbnail_url ? (
                                                    <img src={selectedPlan.thumbnail_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xl">✈️</div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                    {selectedPlan.title}
                                                    <span className="text-[#1392ec]">✔</span>
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {selectedPlan.start_date.replace(/-/g, '.')} - {selectedPlan.end_date.replace(/-/g, '.')}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Day Chips */}
                                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                            {getDaysArray(selectedPlan.start_date, selectedPlan.end_date).map((day) => (
                                                <button
                                                    key={day.date}
                                                    onClick={() => handleDateSelect(day.date)}
                                                    className={`flex flex-col items-center justify-center min-w-[70px] h-[70px] rounded-2xl border transition-all ${selectedDate === day.date
                                                            ? "bg-[#1392ec] border-[#1392ec] text-white shadow-lg shadow-blue-500/30"
                                                            : "bg-white dark:bg-[#1e2b36] border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-300"
                                                        }`}
                                                >
                                                    <span className={`text-sm font-bold ${selectedDate === day.date ? "text-white" : "text-[#1392ec]"}`}>
                                                        {day.label}
                                                    </span>
                                                    <span className="text-xs opacity-80">
                                                        {day.fullDate} {day.dayName}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Upcoming Plans List */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400">
                                    {t('label_upcoming_trips') || "다가오는 여행"}
                                </h3>
                                {plans.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400">
                                        {t('msg_no_upcoming_plans') || "예정된 여행이 없습니다."}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {plans.filter(p => p.id !== selectedPlan?.id).map(plan => (
                                            <button
                                                key={plan.id}
                                                onClick={() => handlePlanSelect(plan)}
                                                className="w-full flex items-center gap-4 bg-white dark:bg-[#1e2b36] p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 transition-all text-left group"
                                            >
                                                <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                                                    {plan.thumbnail_url ? (
                                                        <img src={plan.thumbnail_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-xl">🏔️</div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900 dark:text-white group-hover:text-[#1392ec] transition-colors">{plan.title}</div>
                                                    <div className="text-sm text-gray-500">
                                                        {plan.start_date.replace(/-/g, '.')} - {plan.end_date.replace(/-/g, '.')}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Button */}
                <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-[#1e2b36]">
                    <button
                        onClick={handleAddToPlan}
                        disabled={!selectedPlan || !selectedDate || submitting}
                        className="w-full py-4 bg-[#1392ec] hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:shadow-none"
                    >
                        {submitting ? (t('msg_adding') || "추가 중...") : (t('btn_add_to_selected_schedule') || "일정에 추가")}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddToPlanModal;
