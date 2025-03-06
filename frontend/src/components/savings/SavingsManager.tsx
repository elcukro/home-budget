'use client';

import React, { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useSession } from 'next-auth/react';
import { useSettings } from '@/contexts/SettingsContext';
import type { DatePickerProps } from 'antd';
import dayjs from 'dayjs';
import {
  Card,
  Button,
  Select,
  DatePicker,
  Input,
  Table,
  message,
  Modal,
  Form,
  Switch,
  Statistic,
  Row,
  Col,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  FilterOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { Saving, SavingCategory, SavingType } from '@/types/financial-freedom';

const { RangePicker } = DatePicker;

interface SavingsManagerProps {
  onSavingChange?: () => void;
}

interface FilterState {
  category?: SavingCategory;
  dateRange?: [Date | null, Date | null];
}

export const SavingsManager: React.FC<SavingsManagerProps> = ({ onSavingChange }) => {
  const intl = useIntl();
  const { data: session } = useSession();
  const { settings, formatCurrency } = useSettings();
  const [form] = Form.useForm();

  const [savings, setSavings] = useState<Saving[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSaving, setEditingSaving] = useState<Saving | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    category: undefined,
    dateRange: undefined,
  });

  useEffect(() => {
    fetchSavings();
    fetchSummary();
  }, [filters]);

  const fetchSavings = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (filters.category) {
        queryParams.append('category', filters.category);
      }
      if (filters.dateRange?.[0]) {
        queryParams.append('start_date', filters.dateRange[0].toISOString());
      }
      if (filters.dateRange?.[1]) {
        queryParams.append('end_date', filters.dateRange[1].toISOString());
      }

      const response = await fetch('/api/savings?' + queryParams.toString());
      const data = await response.json();
      setSavings(data);
    } catch (error) {
      message.error(intl.formatMessage({ id: 'savings.messages.error.fetch' }));
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await fetch('/api/savings/summary');
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      message.error(intl.formatMessage({ id: 'savings.messages.error.fetch' }));
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const endpoint = editingSaving ? `/api/savings/${editingSaving.id}` : '/api/savings';
      const method = editingSaving ? 'PUT' : 'POST';
      
      // Format the date to YYYY-MM-DD format
      const formattedValues = {
        ...values,
        date: values.date ? values.date.format('YYYY-MM-DD') : undefined,
      };
      
      console.log('Submitting values:', formattedValues);
      
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formattedValues),
      });

      if (response.ok) {
        message.success(
          intl.formatMessage({
            id: editingSaving
              ? 'savings.messages.updated'
              : 'savings.messages.created'
          })
        );
        setModalVisible(false);
        form.resetFields();
        fetchSavings();
        fetchSummary();
        if (onSavingChange) onSavingChange();
      } else {
        // Get more detailed error information
        const errorData = await response.json();
        console.error('API Error:', errorData);
        message.error(
          intl.formatMessage({
            id: editingSaving
              ? 'savings.messages.error.update'
              : 'savings.messages.error.create'
          }) + (errorData.detail ? `: ${errorData.detail}` : '')
        );
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      message.error(
        intl.formatMessage({
          id: editingSaving
            ? 'savings.messages.error.update'
            : 'savings.messages.error.create'
        })
      );
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/savings/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        message.success(intl.formatMessage({ id: 'savings.messages.deleted' }));
        fetchSavings();
        fetchSummary();
        if (onSavingChange) onSavingChange();
      }
    } catch (error) {
      message.error(intl.formatMessage({ id: 'savings.messages.error.delete' }));
    }
  };

  const columns = [
    {
      title: intl.formatMessage({ id: 'savings.fields.date' }),
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: intl.formatMessage({ id: 'savings.fields.category' }),
      dataIndex: 'category',
      key: 'category',
      render: (category: SavingCategory) =>
        intl.formatMessage({ id: `savings.categories.${category}` }),
    },
    {
      title: intl.formatMessage({ id: 'savings.fields.description' }),
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: intl.formatMessage({ id: 'savings.fields.amount' }),
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number, record: Saving) => (
        <span className={record.saving_type === 'deposit' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
          {record.saving_type === 'withdrawal' ? '-' : ''}
          {formatCurrency(amount)}
        </span>
      ),
    },
    {
      title: intl.formatMessage({ id: 'savings.fields.targetAmount' }),
      dataIndex: 'target_amount',
      key: 'target_amount',
      render: (amount: number) => amount ? formatCurrency(amount) : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Saving) => (
        <>
          <Tooltip title={intl.formatMessage({ id: 'common.edit' })}>
            <Button
              icon={<EditOutlined />}
              type="link"
              onClick={() => {
                setEditingSaving(record);
                form.setFieldsValue({
                  ...record,
                  date: record.date ? dayjs(record.date) : null
                });
                setModalVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title={intl.formatMessage({ id: 'common.delete' })}>
            <Button
              icon={<DeleteOutlined />}
              type="link"
              danger
              onClick={() => handleDelete(record.id)}
            />
          </Tooltip>
        </>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        {intl.formatMessage({ id: 'savings.title' })}
      </h1>

      <div className="bg-white dark:bg-background-primary p-6 rounded-lg shadow">
        {/* Summary Section */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-sm font-medium text-secondary mb-1">
                {intl.formatMessage({ id: 'savings.summary.totalSavings' })}
              </h3>
              <p className="text-2xl font-semibold">
                {formatCurrency(summary.total_savings)}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-secondary mb-1">
                {intl.formatMessage({ id: 'savings.summary.monthlyContribution' })}
              </h3>
              <p className="text-2xl font-semibold">
                {formatCurrency(summary.monthly_contribution)}
              </p>
            </div>
          </div>
        )}

        {/* Filters and Actions */}
        <div className="mb-4 flex flex-col md:flex-row justify-between gap-4">
          <div className="flex flex-wrap gap-4">
            <Select
              placeholder={intl.formatMessage({ id: 'savings.filters.category' })}
              allowClear
              style={{ width: 200 }}
              onChange={(value: SavingCategory | undefined) => setFilters({ ...filters, category: value })}
            >
              {Object.values(SavingCategory).map((category) => (
                <Select.Option key={category} value={category}>
                  {intl.formatMessage({ id: `savings.categories.${category}` })}
                </Select.Option>
              ))}
            </Select>
            <RangePicker
              onChange={(dates: [Date | null, Date | null] | null) => 
                setFilters({ ...filters, dateRange: dates || undefined })}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setFilters({ category: undefined, dateRange: undefined });
                fetchSavings();
              }}
              className="bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700"
            >
              {intl.formatMessage({ id: 'savings.filters.clear' })}
            </Button>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingSaving(null);
              form.resetFields();
              setModalVisible(true);
            }}
            className="bg-blue-500 text-white hover:bg-blue-600"
          >
            {intl.formatMessage({ id: 'savings.addNew' })}
          </Button>
        </div>

        {/* Savings Table */}
        <div className="overflow-x-auto">
          <Table
            dataSource={savings}
            columns={columns}
            loading={loading}
            rowKey="id"
            className="dark:table-dark"
            rowClassName="dark:hover:bg-gray-800/50"
          />
        </div>

        {/* Add/Edit Modal */}
        <Modal
          title={intl.formatMessage({
            id: editingSaving ? 'common.edit' : 'savings.addNew'
          })}
          open={modalVisible}
          onCancel={() => {
            setModalVisible(false);
            form.resetFields();
          }}
          footer={null}
          className="dark:bg-background-primary dark:text-white"
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            <Form.Item
              name="category"
              label={intl.formatMessage({ id: 'savings.fields.category' })}
              rules={[{ required: true }]}
            >
              <Select className="dark:bg-gray-800 dark:text-white dark:border-gray-700">
                {Object.values(SavingCategory).map((category) => (
                  <Select.Option key={category} value={category}>
                    {intl.formatMessage({ id: `savings.categories.${category}` })}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="description"
              label={intl.formatMessage({ id: 'savings.fields.description' })}
            >
              <Input className="dark:bg-gray-800 dark:text-white dark:border-gray-700" />
            </Form.Item>

            <Form.Item
              name="amount"
              label={intl.formatMessage({ id: 'savings.fields.amount' })}
              rules={[{ required: true }]}
            >
              <Input type="number" min={0} step={0.01} className="dark:bg-gray-800 dark:text-white dark:border-gray-700" />
            </Form.Item>

            <Form.Item
              name="date"
              label={intl.formatMessage({ id: 'savings.fields.date' })}
              rules={[{ required: true }]}
            >
              <DatePicker style={{ width: '100%' }} className="dark:bg-gray-800 dark:text-white dark:border-gray-700" />
            </Form.Item>

            <Form.Item
              name="saving_type"
              label={intl.formatMessage({ id: 'savings.fields.savingType' })}
              rules={[{ required: true }]}
            >
              <Select className="dark:bg-gray-800 dark:text-white dark:border-gray-700">
                {Object.values(SavingType).map((type) => (
                  <Select.Option key={type} value={type}>
                    {intl.formatMessage({ id: `savings.types.${type}` })}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="is_recurring"
              label={intl.formatMessage({ id: 'savings.fields.isRecurring' })}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="target_amount"
              label={intl.formatMessage({ id: 'savings.fields.targetAmount' })}
            >
              <Input type="number" min={0} step={0.01} className="dark:bg-gray-800 dark:text-white dark:border-gray-700" />
            </Form.Item>

            <Form.Item>
              <div className="flex justify-end gap-2">
                <Button 
                  onClick={() => {
                    setModalVisible(false);
                    form.resetFields();
                  }}
                  className="dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600"
                >
                  {intl.formatMessage({ id: 'common.cancel' })}
                </Button>
                <Button 
                  type="primary" 
                  htmlType="submit"
                  className="bg-blue-500 text-white hover:bg-blue-600"
                >
                  {intl.formatMessage({ id: 'common.save' })}
                </Button>
              </div>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
}; 