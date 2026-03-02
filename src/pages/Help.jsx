import { useState } from 'react'
import { HelpCircle, Search, ChevronDown, ChevronUp, Mail, Phone, MessageCircle, FileText, Book, Video, Download } from 'lucide-react'

const Help = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [openFaq, setOpenFaq] = useState(null)

  const faqs = [
    {
      id: 1,
      question: 'How do I create a new lead?',
      answer: 'To create a new lead, click on the "Create Lead" button in the Leads Management page. Fill in all required fields including name, email, phone, loan amount, partner, and bank. Once submitted, the lead will be added to your system.',
    },
    {
      id: 2,
      question: 'How can I update lead status?',
      answer: 'You can update a lead status by clicking on the status dropdown in the Actions column of the Leads table. Select the new status from the dropdown menu. The status will be updated immediately.',
    },
    {
      id: 3,
      question: 'How do I assign an agent to a lead?',
      answer: 'When creating or editing a lead, you can select an agent from the "Agent" dropdown field. Make sure the agent is active in the Agents Management section before assigning.',
    },
    {
      id: 4,
      question: 'How to generate invoices?',
      answer: 'Navigate to the Invoices Management page and click "Create Invoice". Select the lead, enter the amount, set the due date, and choose the status. The invoice will be automatically generated with a unique invoice number.',
    },
    {
      id: 5,
      question: 'How do I track partner performance?',
      answer: 'Go to the Partners Management page to view detailed performance metrics for each partner including total leads, active leads, completed loans, and commission earned. You can also view individual partner details by clicking the eye icon.',
    },
    {
      id: 6,
      question: 'How to filter leads by status?',
      answer: 'Use the status filter dropdown in the Leads Management page. Select the desired status (Logged, Sanctioned, Partial Disbursed, Disbursed, etc.) to filter the table. You can also use the search bar to find leads by name, email, or phone.',
    },
    {
      id: 7,
      question: 'How do I upload a profile picture?',
      answer: 'Go to Settings page and click "Edit Profile". Then click on the camera icon on your profile picture to upload a new image. Supported formats include JPG, PNG, and GIF.',
    },
    {
      id: 8,
      question: 'How to view notification history?',
      answer: 'Click on the bell icon in the header to view all notifications. You can mark notifications as read, delete them, or mark all as read. Notifications are automatically updated every 30 seconds.',
    },
  ]

  const filteredFaqs = faqs.filter((faq) =>
    faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const toggleFaq = (id) => {
    setOpenFaq(openFaq === id ? null : id)
  }

  const quickLinks = [
    { icon: FileText, title: 'User Guide', description: 'Complete guide to using the system', link: '#' },
    { icon: Video, title: 'Video Tutorials', description: 'Watch step-by-step video guides', link: '#' },
    { icon: Book, title: 'Documentation', description: 'Technical documentation and API docs', link: '#' },
    { icon: Download, title: 'Download Resources', description: 'Templates and resources', link: '#' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Help Center</h1>
        <p className="text-sm text-gray-600 mt-1">Get help and support</p>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search for help articles, FAQs, or guides..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickLinks.map((link, index) => {
          const Icon = link.icon
          return (
            <a
              key={index}
              href={link.link}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center">
                  <Icon className="w-6 h-6 text-primary-900" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{link.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">{link.description}</p>
                </div>
              </div>
            </a>
          )
        })}
      </div>

      {/* Contact Support */}
      <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg border border-primary-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Need More Help?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-900 rounded-full flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Email Support</p>
              <p className="text-xs text-gray-600">support@ykc.com</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-900 rounded-full flex items-center justify-center">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Phone Support</p>
              <p className="text-xs text-gray-600">+1 (234) 567-8900</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-900 rounded-full flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Live Chat</p>
              <p className="text-xs text-gray-600">Available 24/7</p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQs Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <HelpCircle className="w-5 h-5 text-primary-900" />
          <h2 className="text-lg font-semibold text-gray-900">Frequently Asked Questions</h2>
        </div>
        <div className="space-y-3">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No FAQs found matching your search.</p>
            </div>
          ) : (
            filteredFaqs.map((faq) => (
              <div
                key={faq.id}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleFaq(faq.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="text-sm font-medium text-gray-900">{faq.question}</span>
                  {openFaq === faq.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                {openFaq === faq.id && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-200">
                    <p className="text-sm text-gray-600">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Getting Started Guide */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Getting Started</h2>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-semibold text-primary-900">1</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Create Your First Lead</h3>
              <p className="text-sm text-gray-600 mt-1">
                Start by creating a lead in the Leads Management section. Fill in all required information and assign it to a partner.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-semibold text-primary-900">2</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Manage Partners</h3>
              <p className="text-sm text-gray-600 mt-1">
                Add partners in the Partners Management section. Partners can be assigned to leads and will track their performance automatically.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-semibold text-primary-900">3</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Track Progress</h3>
              <p className="text-sm text-gray-600 mt-1">
                Monitor lead status, generate invoices, and track payouts through the respective management pages.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-semibold text-primary-900">4</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">View Analytics</h3>
              <p className="text-sm text-gray-600 mt-1">
                Check the Dashboard for comprehensive analytics, charts, and performance metrics.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Help
