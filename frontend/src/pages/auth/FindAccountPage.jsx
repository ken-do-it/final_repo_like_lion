import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import api from '../../api/axios';

const FindAccountPage = () => {
    const [activeTab, setActiveTab] = useState('find_id'); // 'find_id' or 'find_pw'
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [step, setStep] = useState(1); // 1: Input Email, 2: Verification, 3: Result
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleSendVerification = async () => {
        setIsLoading(true);
        setMessage('');
        try {
            const purpose = activeTab === 'find_id' ? 'FIND_ID' : 'FIND_PASSWORD';
            await api.post('/users/send-verification/', { email, purpose });
            setStep(2);
            setMessage('Verification code sent to your email.');
        } catch (err) {
            setMessage('Failed to send verification code. User might not exist.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerify = async () => {
        setIsLoading(true);
        setMessage('');
        try {
            await api.post('/users/verify-email/', { email, code });
            setStep(3);
            if (activeTab === 'find_id') {
                setMessage('Verification successful! Your ID has been sent to your email.'); // In a real app we might show it here or send it via email
            } else {
                setMessage('Verification successful! Please check your email for the password reset link.');
            }
        } catch (err) {
            setMessage('Invalid verification code.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Layout>
            <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[calc(100vh-64px-130px)]">
                <div className="w-full max-w-md bg-white dark:bg-dark-surface p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800">

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700 mb-8">
                        <button
                            className={`flex-1 py-4 text-center font-medium transition-colors ${activeTab === 'find_id' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => { setActiveTab('find_id'); setStep(1); setMessage(''); setEmail(''); }}
                        >
                            아이디 찾기
                        </button>
                        <button
                            className={`flex-1 py-4 text-center font-medium transition-colors ${activeTab === 'find_pw' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => { setActiveTab('find_pw'); setStep(1); setMessage(''); setEmail(''); }}
                        >
                            비밀번호 재설정
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div className="text-center mb-4">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {activeTab === 'find_id' ? '아이디 찾기' : '비밀번호 재설정'}
                            </h2>
                            <p className="text-sm text-gray-500">
                                {step === 1 && "가입할 때 사용한 이메일 주소를 입력하세요"}
                                {step === 2 && "이메일로 전송된 인증 코드를 입력하세요"}
                                {step === 3 && "처리 완료되었습니다"}
                            </p>
                        </div>

                        {message && (
                            <div className={`p-3 text-sm rounded ${step === 3 ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                                {message}
                            </div>
                        )}

                        {step === 1 && (
                            <>
                                <Input
                                    id="email"
                                    type="email"
                                    label="이메일 주소"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@example.com"
                                />
                                <Button fullWidth onClick={handleSendVerification} disabled={!email || isLoading}>
                                    {isLoading ? '전송 중...' : '인증 코드 보내기'}
                                </Button>
                            </>
                        )}

                        {step === 2 && (
                            <>
                                <Input
                                    id="code"
                                    label="인증 코드"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    placeholder="인증코드 6자리"
                                />
                                <Button fullWidth onClick={handleVerify} disabled={!code || isLoading}>
                                    {isLoading ? '확인 중...' : '코드 확인'}
                                </Button>
                            </>
                        )}

                        {step === 3 && (
                            <div className="text-center pt-4">
                                <Link to="/login-page">
                                    <Button fullWidth variant="outline">로그인 페이지로</Button>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default FindAccountPage;
